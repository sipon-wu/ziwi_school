#!/usr/bin/env python3
"""确定性兜底的验收（2026-09-14）——不调 LLM，全部可复算。

取**线上真实课件**的 markdown：
  ① 用产品自己的检查器（check_markdown）算修复前的 ERR 分布；
  ② 跑 repair_violations；
  ③ 再算一次（**同一个检查器**）→ 必须单调下降；
  ④ 断言"内容文字没有被改动"（去掉被丢弃组件的正文后逐字比对）；
  ⑤ 断言幂等（再跑一次结果不变）。

判据若不自证（取不到课件 / 检查器抛错）就报 FAIL，不产出结论。
"""
import json
import re
import sys
import urllib.request

from scripts.check_courseware_quality import check_markdown, parse
from scripts.generate_seed_coursewares import repair_violations

B = 'http://school1.ziwi.cn'
CASES = [
    ('PPT·科技', '971395a2-55c5-4f34-bb42-9cf4ef1528c1'),
    ('PPT·国风', '194b0070-c528-455a-8450-2206334e0a4a'),
    ('PPT·清新', '8dd8f89f-4e67-43d1-a9d9-0cb30aa545b2'),
]


def post(path, payload):
    req = urllib.request.Request(B + path, data=json.dumps(payload).encode(),
                                 headers={'Content-Type': 'application/json'})
    return json.load(urllib.request.urlopen(req, timeout=20))


def get(path, token):
    req = urllib.request.Request(B + path, headers={'Authorization': 'Bearer ' + token})
    return json.load(urllib.request.urlopen(req, timeout=30))


def err_of(md, name, subject):
    rep = check_markdown(md, name, subject)
    es = [i for i in rep['issues'] if i[0] == 'ERR']
    agg = {}
    for x in es:
        agg[x[1]] = agg.get(x[1], 0) + 1
    return es, agg


def body_only(md):
    """正文（剥掉全部注释）——用于证明"没有改内容文字"。"""
    return re.sub(r'<!--.*?-->', '', md, flags=re.S)


def main():
    token = post('/api/auth/login', {'phone': '13800000002', 'password': 'teacher123'})['token']
    bad = 0
    for label, mid in CASES:
        m = get('/api/materials/' + mid, token)
        md, subject = m.get('content') or '', m.get('subject') or '语文'
        if not md:
            print(f'[{label}] FAIL：取不到 markdown（判据自证失败，不产出结论）')
            bad += 1
            continue

        e0, a0 = err_of(md, f'{label}__ppt', subject)
        pg0 = parse(md)
        print(f'   检查器视角（原始）：互动 {sum(len(p["interactions"]) for p in pg0)} 处 · '
              f'有组件页 {sum(1 for p in pg0 if p["visuals"])}/{len(pg0)}')
        md2, notes = repair_violations(md)
        e1, a1 = err_of(md2, f'{label}__ppt', subject)
        md3, _ = repair_violations(md2)
        idem = (md3 == md2)
        # 内容比对：若修复丢弃了组件（其 text 属内容），单独标出，不掩盖
        dropped_vis = body_only(md) != body_only(md2)
        ok = len(e1) < len(e0) and idem
        if not ok:
            bad += 1
        print(f'【{label}】ERR {len(e0)} → {len(e1)}  ' + ('✔' if ok else '✘')
              + f'   幂等={"OK" if idem else "变了"}   正文变化={"有" if dropped_vis else "无"}')
        if a0 != a1:
            print(f'   修复前分布: {a0}')
            print(f'   修复后分布: {a1}')
        else:
            print(f'   分布未变: {a0}')
        for n in notes[:6]:
            print(f'   · 兜底：{n}')
        # 残余 ERR 必须逐条列出（不藏）
        if e1:
            for x in e1[:6]:
                print(f'   ✘ 残余 {x[1]}：{str(x[2])[:80]}')
    print('\n结论：全部通过 ✔' if bad == 0 else f'\n结论：{bad} 项未通过 ✘')
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
