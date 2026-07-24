# -*- coding: utf-8 -*-
"""
教材正文页 识别 流水线 (云端批作业形态 / cloud batch, in-memory)
================================================================
架构 (对应 "先存图片链接, 云端小批量长周期识别"):
  - 图片链接已存于 output/raw_tch_material.json (每页 preview URL), 本脚本不下载/不存原图。
  - 识别 全程【内存】进行: 拉取 URL -> bytes -> cv2 解码进内存 -> RapidOCR(np数组) -> 丢弃 bytes。
    不写任何 JPG 到磁盘 (规避本地沙箱禁止删除 / 云端零存储)。
  - 只把识别出的【文本 chunk】追加写入 jsonl (体积极小, 数百 MB 封顶)。
  - checkpoint: 已完成的 bookId 记入 done 文件, 长周期作业可断点续跑、幂等。

两种用法:
  1) 单本/抽检 (本地验证):
     ocr_env/Scripts/python.exe textbook_source.py --bookid <id> [--keep 3]
  2) 云端小批量长周期批作业:
     ocr_env/Scripts/python.exe textbook_source.py --batch-file 教材正文_小学语数英优先档.csv \
            --batch 20 --done-file 教材正文识别_done.jsonl
     (每次跑一小批; 定时/循环调用即可长周期铺完; 已完成的自动跳过)

依赖: rapidocr-onnxruntime (onnxruntime + opencv-python + numpy), 在 ocr venv 内。
"""
import json, urllib.request, concurrent.futures, time, sys, argparse, hashlib, csv, shutil
from pathlib import Path
from datetime import datetime

ROOT = Path("D:/工业元/数云_新质力/知微教育")
RAW = ROOT / "output/raw_tch_material.json"
BOOKID_FULL = ROOT / "output/bookid_map_full.jsonl"
QA_DIR = ROOT / "output/教材正文QA"           # --keep>0 时本地留存抽检页
OUT_JSONL = ROOT / "output/底料_教材正文.jsonl"
OUT_SUMMARY = ROOT / "output/底料_教材正文_summary.json"

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
REF = "https://basic.smartedu.cn/"
TIMEOUT = 45
DL_WORKERS = 12
MIN_BYTES = 5_000
COPYRIGHT = "教育部资源中心；未经允许不得转载或引用"

def load_recs():
    return json.load(open(RAW, encoding="utf-8"))

def get_book(recs, bid):
    for r in recs:
        b = (r.get("custom_properties") or {}).get("global_resource_id")
        if b == bid:
            return r
    return None

def no_lessonplan_bookids():
    full = set()
    if BOOKID_FULL.exists():
        for line in open(BOOKID_FULL, encoding="utf-8"):
            line = line.strip()
            if line:
                full.add(json.loads(line).get("bookId"))
    recs = load_recs()
    return [ (r.get("custom_properties") or {}).get("global_resource_id")
             for r in recs
             if (r.get("custom_properties") or {}).get("global_resource_id") not in full ]

def slide_keys(prev):
    def num(k):
        s = k.replace("Slide", "")
        return int(s) if s.isdigit() else 9999
    return sorted(prev.keys(), key=num)

def download_bytes(args):
    """拉取单页 -> 内存 bytes (不落盘) ; 返回 (key, bytes_or_None, status)"""
    key, url = args
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": REF})
        data = urllib.request.urlopen(req, timeout=TIMEOUT).read()
        if len(data) < MIN_BYTES:
            return key, None, f"small({len(data)})"
        return key, data, "ok"
    except Exception as e:
        return key, None, str(e)[:60]

def ocr_engine():
    from rapidocr_onnxruntime import RapidOCR
    return RapidOCR()

def process_book(r, engine, max_pages=0, keep=0):
    import cv2, numpy as np
    cp = r.get("custom_properties") or {}
    prev = cp.get("preview") or {}
    tg = {t["tag_dimension_id"]: t["tag_name"] for t in (r.get("tag_list") or [])}
    title = (r.get("global_title") or {}).get("zh-CN", "")
    bid = cp.get("global_resource_id") or r.get("id")

    keys = slide_keys(prev)
    if max_pages:
        keys = keys[:max_pages]
    tasks = [(k, prev[k]) for k in keys]

    # 并发下载到内存 (峰值=一本书页数, 数十 MB)
    with concurrent.futures.ThreadPoolExecutor(max_workers=DL_WORKERS) as ex:
        dres = list(ex.map(download_bytes, tasks))
    dl_ok = [(k, b) for k, b, st in dres if b]

    chunks, failed, page_detail = [], [], []
    for idx, (k, data) in enumerate(dl_ok):
        page_no = int(k.replace("Slide", "")) if k.replace("Slide", "").isdigit() else 0
        img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
        if img is None:
            failed.append(k); continue
        try:
            result, _ = engine(img)
        except Exception as e:
            failed.append(k); continue
        texts = [t[1] for t in (result or [])]
        scores = [float(t[2]) for t in (result or []) if len(t) > 2]
        full = "\n".join(texts).strip()
        # 可选: 本地留存前 N 页供抽检 (仅 QA 用, 云端设 keep=0)
        if keep and idx < keep:
            qd = QA_DIR / bid; qd.mkdir(parents=True, exist_ok=True)
            (qd / f"{k}.jpg").write_bytes(data)
        # data (bytes) 此处离开作用域即被回收 -> 不落盘即删
        if not full:
            failed.append(k); continue
        avg = round(sum(scores)/len(scores), 3) if scores else 0.0
        body = {
            "教材标题": title, "教材bookId": bid, "页码": page_no,
            "学制": f"{tg.get('zxxxd','')}/{tg.get('zxxxk','')}/{tg.get('zxxnj','')}/{tg.get('zxxcc','')}/{tg.get('zxxbb','')}",
            "预览图URL": prev[k],
            "正文文本": full, "识别平均置信度": avg,
            "版权标识": COPYRIGHT,
        }
        chunk = {
            "chunk_id": hashlib.sha1((bid+"/"+k).encode("utf-8")).hexdigest(),
            "学段": tg.get("zxxxd",""), "学科": tg.get("zxxxk",""), "年级": tg.get("zxxnj",""),
            "册别": tg.get("zxxcc",""), "版本": tg.get("zxxbb",""),
            "单元": "", "章节": f"第{page_no}页",
            "来源类型": "教材-正文页", "来源标识": bid,
            "正文": json.dumps(body, ensure_ascii=False),
            "关联课标条目": "", "关联KG单元": "",
            "版权标识": COPYRIGHT, "预览图URL": prev[k], "预览图本地路径": "",
        }
        chunks.append(chunk)
        page_detail.append({"页码": page_no, "字符数": len(full), "置信度": avg})

    return title, bid, tg, prev, chunks, failed, page_detail

def load_done(path):
    s = set()
    if path.exists():
        for line in open(path, encoding="utf-8"):
            line = line.strip()
            if line:
                try: s.add(json.loads(line)["bookId"])
                except: pass
    return s

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bookid")
    ap.add_argument("--auto-pick", action="store_true")
    ap.add_argument("--subject", default="")
    ap.add_argument("--max-pages", type=int, default=0)
    ap.add_argument("--keep", type=int, default=0, help="本地留存前N页供抽检(云端设0)")
    # 云端批作业参数
    ap.add_argument("--batch-file", help="CSV(jsonl亦可), 含 bookId 列")
    ap.add_argument("--batch", type=int, default=0, help="每轮处理多少本新书的批大小(0=全部)")
    ap.add_argument("--done-file", default="output/教材正文识别_done.jsonl", help="已完成 bookId 检查点")
    ap.add_argument("--col", default="bookId", help="batch-file 中 bookId 列名")
    args = ap.parse_args()

    engine = ocr_engine()
    recs = load_recs()

    # ---- 单本 / 自动挑 ----
    if args.bookid or args.auto_pick:
        if args.bookid:
            r = get_book(recs, args.bookid)
            if not r: print(f"未找到 {args.bookid}"); return
        else:
            cands = no_lessonplan_bookids()
            if args.subject:
                sub = []
                for b in cands:
                    rr = get_book(recs, b)
                    names = [t.get("tag_name", "") for t in (rr.get("tag_list") or [])]
                    if args.subject in names:
                        sub.append(b)
                cands = sub
            if not cands: print("无候选"); return
            r = get_book(recs, cands[0])
            print(f"auto-pick: {cands[0]} (候选 {len(cands)})")
        title, bid, tg, prev, chunks, failed, pd = process_book(r, engine, args.max_pages, args.keep)
        _emit(chunks, title, bid, tg, prev, failed, pd)
        return

    # ---- 云端小批量长周期批作业 ----
    if args.batch_file:
        bf = Path(args.batch_file)
        bids = []
        if bf.suffix == ".jsonl":
            for line in open(bf, encoding="utf-8"):
                line=line.strip()
                if line: bids.append(json.loads(line).get(args.col))
        else:
            with open(bf, encoding="utf-8") as f:
                for row in csv.DictReader(f):
                    bids.append(row.get(args.col))
        bids = [b for b in bids if b]
        done = load_done(ROOT / args.done_file)
        todo = [b for b in bids if b not in done]
        print(f"批文件共 {len(bids)} 本, 已完成 {len(done)}, 待处理 {len(todo)}")
        if args.batch:
            todo = todo[:args.batch]
        print(f"本轮处理 {len(todo)} 本")
        done_path = ROOT / args.done_file
        t_all = time.time()
        for i, bid in enumerate(todo, 1):
            r = get_book(recs, bid)
            if not r:
                print(f"  [{i}/{len(todo)}] 跳过(无元数据): {bid}"); continue
            try:
                title, b2, tg, prev, chunks, failed, pd = process_book(r, engine)
            except Exception as e:
                print(f"  [{i}/{len(todo)}] 异常跳过: {bid} -> {e}"); continue
            _emit(chunks, title, b2, tg, prev, failed, pd)
            with open(done_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"bookId": bid, "ts": datetime.now().isoformat(timespec="seconds")}, ensure_ascii=False)+"\n")
            print(f"  [{i}/{len(todo)}] {title}: 识别 {len(chunks)} 页, 失败 {len(failed)}, 累计{time.time()-t_all:.0f}s", flush=True)
        print(f"\n=== 本轮结束: 处理 {len(todo)} 本, 总耗时 {time.time()-t_all:.0f}s ===")
        print(f"检查点: {done_path}")
        return

    print("用法:\n  --bookid <id> [--keep 3]\n  --batch-file <csv> --batch 20 --done-file 教材正文识别_done.jsonl")

def _emit(chunks, title, bid, tg, prev, failed, pd):
    if chunks:
        with open(OUT_JSONL, "a", encoding="utf-8") as f:
            for c in chunks:
                f.write(json.dumps(c, ensure_ascii=False) + "\n")
    summ = {
        "处理时间": datetime.now().isoformat(timespec="seconds"),
        "教材标题": title, "bookId": bid,
        "学制": f"{tg.get('zxxxd','')}/{tg.get('zxxxk','')}/{tg.get('zxxnj','')}/{tg.get('zxxcc','')}/{tg.get('zxxbb','')}",
        "预览页总数": len(prev), "识别成功页": len(chunks),
        "识别失败/空页": len(failed),
        "总识别字符数": sum(p["字符数"] for p in pd),
        "平均置信度": round(sum(p["置信度"] for p in pd)/len(pd),3) if pd else 0,
        "产出chunk数": len(chunks),
        "样本页(前3页)": pd[:3],
    }
    with open(OUT_SUMMARY, "w", encoding="utf-8") as f:
        json.dump(summ, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()
