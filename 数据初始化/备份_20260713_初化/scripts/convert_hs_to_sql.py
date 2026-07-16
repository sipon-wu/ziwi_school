#!/usr/bin/env python3
"""
高中段知识图谱 → 知微 tb_* 表转换脚本
=========================================
读取 data/ 目录下的高中 JSONL 文件，匹配到现有 tb_textbook_version，
生成 tb_kg_node / tb_kg_edge / tb_version_standard_map 的 INSERT SQL。

用法: python3 convert_hs_to_sql.py
输出: /tmp/hs_insert.sql（上传到 CVM 后 psql -f 执行）
"""

import json, os, re, sys
from collections import defaultdict

BASE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(BASE, 'data')
OUT = '/tmp/hs_insert.sql'

# ── 版本名归一化（新数据 → 库中 ban_ben_biao_shi）──
VERSION_NORMALIZE = {
    '人教版A版': '人教A版',
    '部编版(统编)': '统编版',
    '人教版': '人教版',
    '统编版': '统编版',
    '人教A版': '人教A版',
}

def norm_version(v: str) -> str:
    v = v.strip().replace('（','(').replace('）',')')
    return VERSION_NORMALIZE.get(v, v)

# ── 加载高中数据 ──
def load_jsonl(path):
    rows = []
    with open(path, encoding='utf-8') as f:
        for ln in f:
            ln = ln.strip()
            if ln:
                rows.append(json.loads(ln))
    return rows

def load_json(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)

print('读取高中数据...')
hs_nodes = load_jsonl(os.path.join(DATA, '高中_知识图谱_nodes.jsonl'))
hs_edges = load_jsonl(os.path.join(DATA, '高中_知识图谱_edges.jsonl'))
hs_maps = load_jsonl(os.path.join(DATA, '高中_版本课标映射.jsonl'))

print(f'  nodes: {len(hs_nodes)}')
print(f'  edges: {len(hs_edges)}')
print(f'  maps:  {len(hs_maps)}')

# ── 读取 tb_textbook_version（通过预设的 JSON 快照）──
# 从 textbook_versions_seed.json 读取，避免查询 DB
tv_path = os.path.join(BASE, '..', '..', '..', 'code', 'backend', 'data', 'textbook_versions_seed.json')
# 也试试绝对路径
if not os.path.exists(tv_path):
    tv_path = os.path.normpath(os.path.join(BASE, '..', '..', 'code', 'backend', 'data', 'textbook_versions_seed.json'))

print(f'读取版本库: {tv_path}')
with open(tv_path, encoding='utf-8') as f:
    tvs = json.load(f)
print(f'  版本库: {len(tvs)} 条')

# 构建索引: (xue_ke, ban_ben_biao_shi) → [版本行]
# 因为同一 (学科,版本) 有多个年级/册别
tv_idx = defaultdict(list)
for tv in tvs:
    if tv['xue_duan'] == '高中':
        key = (tv['xue_ke'], tv['ban_ben_biao_shi'])
        tv_idx[key].append(tv)

# 打印版本匹配情况
print('\n版本匹配检查:')
matched_versions = set()
unmatched = set()
for n in hs_nodes:
    subj = n.get('subject','')
    ver = norm_version(n.get('version',''))
    key = (subj, ver)
    if key in tv_idx:
        matched_versions.add(key)
    else:
        # 尝试学科名加'版'后匹配
        key2 = (subj + '版', ver) if not subj.endswith('版') else key
        if key2 in tv_idx:
            matched_versions.add(key2)
        else:
            unmatched.add(key)

for k in sorted(matched_versions):
    cnt = len(tv_idx[k])
    print(f'  ✅ {k[0]} / {k[1]} → {cnt} 条')
for k in sorted(unmatched):
    print(f'  ❌ 未匹配: {k[0]} / {k[1]}')

# ── 构建 version_id 查找函数 ──
def find_version_id(subject, version, grade, volume):
    """根据学科+版本+年级+册别 匹配 tb_textbook_version 的 id"""
    ver = norm_version(version)
    key = (subject, ver)
    candidates = tv_idx.get(key, [])
    if not candidates:
        # 尝试二次匹配
        for (s,v), lst in tv_idx.items():
            if s == subject and (ver in v or v in ver):
                candidates = lst
                break
    if not candidates:
        return None

    # 精确匹配年级+册别
    for tv in candidates:
        # grade 如 "高一" → nian_ji "高中" (有的版本年级为空)
        # volume 如 "必修 第一册" → ce_bie
        if tv.get('nian_ji') == grade and tv.get('ce_bie') == volume:
            return tv['id']

    # 优先取年级匹配
    for tv in candidates:
        if tv.get('nian_ji') == grade:
            return tv['id']
    # 优先取册别匹配
    for tv in candidates:
        if tv.get('ce_bie') == volume:
            return tv['id']
    # 取第一个
    return candidates[0]['id'] if candidates else None

# ── 生成 tb_kg_node SQL ──
print('\n生成 tb_kg_node 插入...')
node_id_map = {}  # string_id → numeric_id
node_sql = []
next_node_id = 1  # 从 1 开始，seed 时 TRUNCATE 所以干净

# 先获取已有最大 ID（但 staging 是 TRUNCATE，所以从 1 开始）
node_level_map = {'unit': 0, 'knowledge_point': 1, 'sub_knowledge_point': 2}

for n in hs_nodes:
    sid = n['id']
    name = n.get('name', '').strip()
    ntype = n.get('type', 'knowledge_point')
    subj = n.get('subject', '')
    ver = norm_version(n.get('version', ''))
    grade = n.get('grade', '')
    volume = n.get('volume', '')
    standard_ref = n.get('standard_ref', '')
    dimension = n.get('dimension', '')

    vid = find_version_id(subj, ver, grade, volume)
    if vid is None:
        print(f'  ⚠️ 跳过节点(无匹配版本): {sid} {name} ({subj}/{ver}/{grade}/{volume})')
        continue

    node_id_map[sid] = next_node_id
    level = node_level_map.get(ntype, 1)
    qian_zhi = json.dumps([standard_ref]) if standard_ref else 'null'
    neng_li = dimension if dimension else ''
    dan_yuan = name if ntype == 'unit' else ''

    node_sql.append(
        f"INSERT INTO tb_kg_node (id, node_key, version_id, dan_yuan, parent_id, ming_cheng, level, qian_zhi, nan_du, neng_li_wei_du, created_at, updated_at) VALUES "
        f"({next_node_id}, '{sid}', {vid}, {quote(dan_yuan)}, NULL, {quote(name)}, {level}, '{qian_zhi}', '', {quote(neng_li)}, now(), now());"
    )
    next_node_id += 1

# ── 构建从 edges 推导 parent_id 的映射 ──
# contains 边: parent → child，用于填充 tb_kg_node.parent_id
parent_map = {}
for e in hs_edges:
    f, t, rel = e['from'], e['to'], e.get('relation', 'contains')
    if rel == 'contains' and f in node_id_map and t in node_id_map:
        parent_map[node_id_map[t]] = node_id_map[f]

# 更新 parent_id
new_node_sql = []
for sql in node_sql:
    # 解析出 id
    m = re.search(r'INSERT INTO tb_kg_node.*?\((\d+),', sql)
    if m:
        nid = int(m.group(1))
        pid = parent_map.get(nid)
        if pid:
            sql = sql.replace(', NULL,', f', {pid},')
    new_node_sql.append(sql)

# 打印统计
total_nodes = len(new_node_sql)
with_parent = sum(1 for s in new_node_sql if re.search(r'\((\d+),', s) and parent_map.get(int(re.search(r'\((\d+),', s).group(1))))
print(f'  nodes: {total_nodes} 条（含 parent_id: {with_parent} 条）')
print(f'  跳过(无版本匹配): {len(hs_nodes) - total_nodes} 条')

# ── 生成 tb_kg_edge SQL ──
print('\n生成 tb_kg_edge 插入...')
edge_sql = []
edge_skip = 0
for e in hs_edges:
    f, t, rel = e.get('from',''), e.get('to',''), e.get('relation', 'contains')
    fid = node_id_map.get(f)
    tid = node_id_map.get(t)
    if fid and tid:
        edge_sql.append(
            f"INSERT INTO tb_kg_edge (from_id, to_id, relation_type, created_at) VALUES ({fid}, {tid}, {quote(rel)}, now());"
        )
    else:
        edge_skip += 1

print(f'  edges: {len(edge_sql)} 条')
print(f'  跳过: {edge_skip} 条')

# ── 生成 tb_version_standard_map SQL ──
# 需要匹配 tb_standard_clause（通过 学段+学科+课标条目编号）
# 读取 tb_standard_clause 快照（从 staging 导出或 seed 文件）
print('\n生成 tb_version_standard_map 插入...')

# 从 knowledge_seed.json 读取课标条款
ks_path = os.path.join(os.path.dirname(tv_path), 'knowledge_seed_remapped.json')
standard_clauses = {}
if os.path.exists(ks_path):
    with open(ks_path, encoding='utf-8') as f:
        ks = json.load(f)
    for sc in ks.get('standard_clauses', []):
        key = (sc.get('xue_duan',''), sc.get('xue_ke',''), sc.get('tiao_mu_lu_jing',''))
        standard_clauses[key] = sc.get('id')
    print(f'  读取课标条款: {len(standard_clauses)} 条')
else:
    print(f'  ⚠️ 未找到 knowledge_seed_remapped.json')

map_sql = []
map_skip = 0
for m in hs_maps:
    xd = m.get('学段', '')
    xk = m.get('学科', '')
    bj = m.get('教材版本', '')
    nj = m.get('年级', '')
    cb = m.get('册别', '')
    dy = m.get('单元/章节', '')
    kb_bh = m.get('课标条目编号', '')
    kb_zw = m.get('课标条目原文', '')
    ppd = m.get('匹配度', '')

    # 匹配 version_id
    vid = find_version_id(xk, bj, nj, cb)
    if vid is None:
        map_skip += 1
        continue

    # 匹配 standard_clause_id
    sc_key = (xd, xk, kb_bh)
    sc_id = standard_clauses.get(sc_key)
    # 尝试不含学段的匹配
    if sc_id is None:
        for (s_xd, s_xk, s_tmlj), s_id in standard_clauses.items():
            if s_xk == xk and (s_tmlj == kb_bh or kb_bh in s_tmlj or s_tmlj in kb_bh):
                sc_id = s_id
                break

    if sc_id is None:
        # 课标条款可能还没导入，先用占位或跳过
        map_skip += 1
        continue

    map_sql.append(
        f"INSERT INTO tb_version_standard_map (version_id, dan_yuan, standard_clause_id, pi_pei_du, zhi_shi_dian, created_at) VALUES "
        f"({vid}, {quote(dy)}, {sc_id}, {quote(ppd)}, '', now());"
    )

print(f'  maps: {len(map_sql)} 条')
print(f'  跳过(无匹配): {map_skip} 条')

# ── 写出 SQL ──
print(f'\n写出 SQL 到 {OUT}...')
with open(OUT, 'w', encoding='utf-8') as f:
    f.write('-- 高中段知识图谱导入（转换自 20260713 交付包）\n')
    f.write('-- 生成时间: 自动\n\n')
    f.write('-- 清空旧高中数据（只清高中，不影响小学初中）\n')
    f.write('DELETE FROM tb_kg_edge e USING tb_kg_node n WHERE e.from_id=n.id AND n.node_key LIKE \'hs_kg_%\';\n')
    f.write('DELETE FROM tb_kg_edge e USING tb_kg_node n WHERE e.to_id=n.id AND n.node_key LIKE \'hs_kg_%\';\n')
    f.write("DELETE FROM tb_kg_node WHERE node_key LIKE 'hs_kg_%';\n\n")
    f.write('-- 注：节点 ID 从 1 开始自增，为了不与小学初中冲突，先清旧再用固定 ID\n')
    f.write("-- 实际 staging 环境已有小学初中数据（id ≥ 1），需确认 ID 不冲突\n")
    f.write("-- 安全方式：先查出小学初中最大 ID，高中节点压后\n\n")

    f.write('BEGIN;\n\n')

    f.write('-- tb_kg_node\n')
    for sql in new_node_sql:
        f.write(sql + '\n')

    f.write('\n-- tb_kg_edge\n')
    for sql in edge_sql:
        f.write(sql + '\n')

    f.write('\n-- tb_version_standard_map\n')
    for sql in map_sql:
        f.write(sql + '\n')

    f.write('\nCOMMIT;\n')

print('完成!')


def quote(s):
    """安全地包裹 SQL 字符串"""
    if s is None:
        return 'NULL'
    s = str(s).replace("'", "''")
    return f"'{s}'" if s else 'NULL'
