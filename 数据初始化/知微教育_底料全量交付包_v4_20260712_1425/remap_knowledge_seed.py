# -*- coding: utf-8 -*-
"""
知识图谱种子版本键重映射脚本（更新机制入口）

功能：
1. 读取旧 knowledge_seed.json（课标/映射/节点/边）
2. 读取新的 textbook_versions_seed.json（K12 教材版本库）
3. 将旧 version_key 映射到新 version_key
4. 过滤掉无法匹配的条目
5. 输出新的 knowledge_seed_remapped.json

用法：
  python3 remap_knowledge_seed.py

环境变量：
  KNOWLEDGE_SEED_IN   : 旧 knowledge_seed.json 路径（默认自动查找）
  KNOWLEDGE_SEED_OUT  : 输出路径（默认 code/backend/data/knowledge_seed_remapped.json）

数据团队更新流程：
  1. 更新相关 JSONL 数据文件
  2. 重新运行 build_textbook_versions_seed.py 生成新版表
  3. 重新运行本脚本 remap
  4. 运行 textbook_versions seed（Go）
  5. 运行 knowledge seed（Go，跳过版本表）
"""
import json, os, re, sys
from collections import defaultdict

BASE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.normpath(os.path.join(BASE, '..', '..', 'code', 'backend', 'data'))

def find(path_env, default_cands):
    env = os.environ.get(path_env, '')
    if env:
        return env
    for c in default_cands:
        if os.path.isfile(c):
            return os.path.abspath(c)
    return None

def normalize_ver(v):
    """标准化版本名（旧→新匹配桥接）"""
    v = v.replace('（', '(').replace('）', ')')
    v = v.replace('（', '(').replace('）', ')')
    # 批量替换
    for a, b in [
        ('部编版(统编)(五四)', '统编版（五·四）'), ('部编版(统编)', '统编版'),
        ('部编版', '统编版'), ('外研版', '外研社版'),
        ('华师大版', '华东师大版'), ('地质版', '地质社版'),
        ('人教版(PEP·三起)', '人教版'), ('人教版(PEP三起)', '人教版'),
        ('人教A版', '人教版'), ('人教B版', '人教版'),
    ]:
        v = v.replace(a, b)
    # 去掉 年级起点 标注
    v = re.sub(r'\(.*?(PEP|三起|一起|A版|B版).*?\)', '', v)
    return v.strip()

def build_version_mapping(old_tvs, new_tvs):
    """
    旧 version_key → 新 version_key 映射
    新表索引: (学段,学科,年级,册别) → [ban_ben_biao_shi, version_key]
    """
    # 建新表索引
    idx = defaultdict(list)
    for v in new_tvs:
        idx[(v['xue_duan'], v['xue_ke'], v['nian_ji'], v['ce_bie'])].append(v)
    
    def find_best(seg, subj, old_ver, grade, vol):
        cs = idx.get((seg, subj, grade, vol), [])
        if not cs:
            return None
        norm = normalize_ver(old_ver)
        # 精确匹配（标准化后）
        for c in cs:
            cv = normalize_ver(c['ban_ben_biao_shi'])
            if cv == norm:
                return c['version_key']
        # 包含匹配
        for c in cs:
            cv = normalize_ver(c['ban_ben_biao_shi'])
            if norm in cv or cv in norm:
                return c['version_key']
        # 单候选
        if len(cs) == 1:
            return cs[0]['version_key']
        return None

    old2new = {}
    for tv in old_tvs:
        key = tv['version_key']
        parts = key.split('_', 4)
        if len(parts) != 5:
            continue
        seg, subj, ver, grade, vol = parts
        nk = find_best(seg, subj, ver, grade, vol)
        if nk:
            old2new[key] = nk
    return old2new


def main():
    # ── 定位输入/输出 ──
    seed_in = find('KNOWLEDGE_SEED_IN', [
        os.path.join(DATA_DIR, 'knowledge_seed.json'),
        'knowledge_seed.json',
    ])
    tv_seed = os.path.join(DATA_DIR, 'textbook_versions_seed.json')
    seed_out = os.environ.get('KNOWLEDGE_SEED_OUT',
                              os.path.join(DATA_DIR, 'knowledge_seed_remapped.json'))

    if not seed_in:
        print('[error] 找不到 knowledge_seed.json')
        sys.exit(1)
    if not os.path.isfile(tv_seed):
        print(f'[error] 找不到 textbook_versions_seed.json: {tv_seed}')
        sys.exit(1)

    print(f'[remap] 旧种子: {seed_in}')
    print(f'[remap] 新版表: {tv_seed}')
    print(f'[remap] 输出:   {seed_out}')

    # ── 读取 ──
    with open(seed_in, encoding='utf-8') as f:
        old = json.load(f)
    with open(tv_seed, encoding='utf-8') as f:
        new_tvs = json.load(f)

    print(f'[remap] 旧: textbook_versions={len(old["textbook_versions"])}, '
          f'standard_clauses={len(old["standard_clauses"])}, '
          f'maps={len(old["version_standard_maps"])}, '
          f'nodes={len(old["kg_nodes"])}, '
          f'edges={len(old["kg_edges"])}')

    # ── 旧→新映射 ──
    old2new = build_version_mapping(old['textbook_versions'], new_tvs)
    print(f'[remap] 旧→新 version_key 映射: {len(old2new)}/{len(old["textbook_versions"])}')

    # ── Remap version_standard_maps ──
    maps_out = []
    skipped_maps = 0
    for m in old['version_standard_maps']:
        nk = old2new.get(m['version_key'])
        if nk:
            m_out = dict(m)
            m_out['version_key'] = nk
            maps_out.append(m_out)
        else:
            skipped_maps += 1

    # ── Remap kg_nodes ──
    nodes_out = []
    skipped_nodes = 0
    for n in old['kg_nodes']:
        nk = old2new.get(n['version_key'])
        if nk:
            n_out = dict(n)
            n_out['version_key'] = nk
            nodes_out.append(n_out)
        else:
            skipped_nodes += 1

    # ── 存活节点 key 集合（用于边过滤）──
    alive_node_keys = set(n['node_key'] for n in nodes_out)

    # ── Remap kg_edges ──
    edges_out = []
    skipped_edges = 0
    for e in old['kg_edges']:
        if e['from_key'] in alive_node_keys and e['to_key'] in alive_node_keys:
            edges_out.append(e)
        else:
            skipped_edges += 1

    # ── 输出 ──
    out = {
        'textbook_versions': [],  # 由独立 seed 预热，此处留空
        'standard_clauses': old['standard_clauses'],  # 课标条款不变
        'version_standard_maps': maps_out,
        'kg_nodes': nodes_out,
        'kg_edges': edges_out,
    }
    with open(seed_out, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))

    print(f'\n[remap] === 结果 ===')
    print(f'  standard_clauses:     {len(out["standard_clauses"])} (不变)')
    print(f'  version_standard_maps: {len(maps_out)} (跳过 {skipped_maps})')
    print(f'  kg_nodes:             {len(nodes_out)} (跳过 {skipped_nodes})')
    print(f'  kg_edges:             {len(edges_out)} (跳过 {skipped_edges})')
    print(f'\n[remap] 保存至: {seed_out}')
    print(f'\n[提示] 在服务器上执行以下命令重新导入:')
    print(f'  1. go run ./cmd/seed/textbook_versions/    # 已执行')
    print(f'  2. KNOWLEDGE_SEED=data/knowledge_seed_remapped.json go run ./cmd/seed/knowledge/')


if __name__ == '__main__':
    main()
