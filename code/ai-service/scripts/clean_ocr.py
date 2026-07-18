#!/usr/bin/env python3
"""教材OCR清洗脚本（分批+恢复点版）。"""
import os, sys, json, re, argparse, time
from concurrent.futures import ThreadPoolExecutor, as_completed
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import dashscope
from dashscope import Generation
dashscope.api_key = os.getenv("DASHSCOPE_API_KEY")
MODEL = "qwen-turbo"
from vector_store import get_conn

SP = """你是一位教材分析专家。判断OCR页面的类型和内容类别，只输出JSON。
page_type: 封面/目录/正文内容页/练习页/附录/版权页/其他
content_class: A(公有领域古典)/B(教材改编)/C(公有领域现代文)/D(保护期现代文)/null
has_full_text: true/false
knowledge_topics: 知识点列表
teaching_hints: 教学要点提示"""

UT = "年级：{g} 页码：{p}\nOCR文本：\n{t}"

def log(m): print(m, flush=True)

def get_remaining():
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT count(*) FROM tb_lesson_source WHERE source_type='教材-正文页(OCR)' AND content LIKE '%OCR文本%'")
    n = cur.fetchone()[0]; conn.close(); return n

def process_batch(size=500):
    conn = get_conn(); cur = conn.cursor()
    cur.execute(f"SELECT chunk_id,grade,chapter,content FROM tb_lesson_source WHERE source_type='教材-正文页(OCR)' AND content LIKE '%OCR文本%' ORDER BY grade,chapter,chunk_id LIMIT {size}")
    rows = cur.fetchall(); cols = [d[0] for d in cur.description]; conn.close()
    if not rows: return 0
    
    ok = fail = 0; updates = []
    with ThreadPoolExecutor(max_workers=5) as ex:
        futs = {}
        for row in rows:
            r = dict(zip(cols, row))
            futs[ex.submit(_proc, r)] = r
        for fut in as_completed(futs):
            cid, nc = fut.result()
            if nc: updates.append((nc, cid)); ok+=1
            else: fail+=1
    
    if updates:
        conn = get_conn(); cur = conn.cursor()
        cur.executemany("UPDATE tb_lesson_source SET content=%s WHERE chunk_id=%s", updates)
        conn.commit(); conn.close()
    return ok, fail

import concurrent.futures as _cf
def _proc(r):
    cid=r["chunk_id"]; g=r.get("grade",""); ch=r.get("chapter","")
    try:
        body=json.loads(r.get("content","{}")); ocr=body.get("OCR文本","")
        if not ocr or not ocr.strip(): return cid,None
        msgs=[{"role":"system","content":SP},{"role":"user","content":UT.format(g=g,p=ch,t=ocr[:800])}]
        with _cf.ThreadPoolExecutor(max_workers=1) as _ex:
            _f=_ex.submit(Generation.call, model=MODEL, messages=msgs, result_format="message", max_tokens=500, temperature=0.1)
            resp=_f.result(timeout=15)
        if resp.status_code!=200: return cid,None
        raw=resp.output.choices[0].message.content
        return cid, _make_new(_parse(raw), ocr)
    except Exception as e:
        return cid,None

def _parse(s):
    a=s.find("{"); b=s.rfind("}")
    if a==-1 or b==-1 or b<=a: raise ValueError
    bd=s[a:b+1].replace('\n',' ').replace('\r',' ')
    for _ in range(10):
        nb=re.sub(r',\s*([}\]])',lambda m:m.group(1),bd)
        if nb==bd: break; bd=nb
    bd=re.sub(r"\\([^\"\\/bfnrtu])",lambda m:m.group(1),bd)
    return json.loads(bd)

def _make_new(pr, ocr):
    if not pr: return json.dumps({"status":"parse_failed"},ensure_ascii=False)
    pc=pr.get("content_class","null"); pt=pr.get("page_type","?")
    if pt in ("封面","目录","版权页","附录") or pc=="null":
        return json.dumps({"class":pc,"page_type":pt,"status":"cleared"},ensure_ascii=False)
    if pc in ("A","C") and pr.get("has_full_text"):
        cl = ocr[:600].strip()
        return json.dumps({"class":pc,"page_type":pt,"status":"kept","cleaned_text":cl,"knowledge_topics":pr.get("knowledge_topics",[]),"teaching_hints":pr.get("teaching_hints","")},ensure_ascii=False)
    return json.dumps({"class":pc,"page_type":pt,"distilled":True,"knowledge_topics":pr.get("knowledge_topics",[]),"teaching_hints":pr.get("teaching_hints","")},ensure_ascii=False)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--batch-size",type=int,default=500)
    ap.add_argument("--max-batches",type=int,default=9999)
    a=ap.parse_args()
    
    total_done=0; total_fail=0
    for b in range(1, a.max_batches+1):
        remaining = get_remaining()
        if remaining == 0:
            log(f"[clean_ocr] 全部完成！总处理: {total_done} 成功, {total_fail} 失败")
            return
        log(f"[clean_ocr] 批次{b}: 剩余{remaining}行, 处理{a.batch_size}行...")
        ok, fail = process_batch(a.batch_size)
        total_done+=ok; total_fail+=fail
        log(f"  批次{b}结束: ok={ok} fail={fail} 累计: {total_done}+{total_fail}")
        time.sleep(1)
    
    remaining = get_remaining()
    log(f"[clean_ocr] 达到最大批次. 剩余: {remaining} 行. 累计: {total_done}+{total_fail}")

if __name__=="__main__": main()
