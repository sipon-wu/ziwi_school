# -*- coding: utf-8 -*-
"""
课本封面图下载器（仅 Slide1 = 每本教材第 1 页/封面）
- 输入: output/raw_tch_material.json (教材原始注册表，含 preview 字典)
- 输出: output/教材封面/{aa}/{bookId}.jpg
- 产物: output/教材封面清单.csv + 回写 底料_教材_全.jsonl 的「封面本地路径」
- 特性: 并发下载、断点续传(跳过已存在>10KB)、失败重试
"""
import json, os, urllib.request, concurrent.futures, csv, time
from pathlib import Path

ROOT = Path("D:/工业元/数云_新质力/知微教育")
RAW = ROOT / "output/raw_tch_material.json"
COVER_DIR = ROOT / "output/教材封面"
JSONL = ROOT / "output/底料_教材_全.jsonl"
MANIFEST = ROOT / "output/教材封面清单.csv"

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
REF = "https://basic.smartedu.cn/"
TIMEOUT = 40
WORKERS = 24
MIN_BYTES = 10_000  # 小于此视为失败/非图

def cover_url_of(rec):
    """返回 (url, 来源key)；无则返回 (None,None)"""
    cp = rec.get("custom_properties") or {}
    prev = cp.get("preview")
    if not isinstance(prev, dict) or not prev:
        return None, None
    # 优先封面候选顺序
    for key in ["Slide1", "Slide0", "1", "0"]:
        if prev.get(key):
            return prev[key], key
    # 兜底：取数字最小的 key
    def num(k):
        s = k.replace("Slide", "")
        return int(s) if s.isdigit() else 9999
    keys = sorted(prev.keys(), key=num)
    if keys:
        return prev[keys[0]], keys[0]
    return None, None

def build_tasks():
    recs = json.load(open(RAW, encoding="utf-8"))
    tasks = []
    for r in recs:
        bid = (r.get("custom_properties") or {}).get("global_resource_id") or r.get("id")
        url, key = cover_url_of(r)
        if url and bid:
            tasks.append((str(bid), url))
    return tasks

def local_path(bid):
    return COVER_DIR / bid[:2] / f"{bid}.jpg"

def download(task):
    bid, url = task
    p = local_path(bid)
    if p.exists() and p.stat().st_size >= MIN_BYTES:
        return (bid, True, "skip")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": REF})
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            data = resp.read()
        if len(data) < MIN_BYTES:
            return (bid, False, f"too_small({len(data)})")
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)
        return (bid, True, "ok")
    except Exception as e:
        return (bid, False, str(e)[:70])

def main():
    COVER_DIR.mkdir(parents=True, exist_ok=True)
    tasks = build_tasks()
    print(f"待下载封面数: {len(tasks)}", flush=True)

    results = {}
    done = 0
    ok = 0
    fail = 0
    t0 = time.time()
    with concurrent.futures.ThreadPoolExecutor(max_workers=WORKERS) as ex:
        futs = {ex.submit(download, t): t for t in tasks}
        for fut in concurrent.futures.as_completed(futs):
            bid, success, status = fut.result()
            results[bid] = success
            done += 1
            if success:
                ok += 1
            else:
                fail += 1
            if done % 200 == 0:
                el = time.time() - t0
                print(f"  [{done}/{len(tasks)}] ok={ok} fail={fail} 耗时={el:.0f}s", flush=True)
    print(f"下载完成: ok={ok} fail={fail} 总={len(tasks)} 耗时={time.time()-t0:.0f}s", flush=True)

    # 写清单 CSV
    recs = json.load(open(RAW, encoding="utf-8"))
    meta = {}
    for r in recs:
        bid = (r.get("custom_properties") or {}).get("global_resource_id") or r.get("id")
        if not bid:
            continue
        tg = {t["tag_dimension_id"]: t["tag_name"] for t in (r.get("tag_list") or [])}
        meta[str(bid)] = {
            "学段": tg.get("zxxxd", ""), "学科": tg.get("zxxxk", ""),
            "年级": tg.get("zxxnj", ""), "册次": tg.get("zxxcc", ""),
            "版本": tg.get("zxxbb", ""),
            "教材标题": (r.get("global_title") or {}).get("zh-CN", ""),
        }
    with open(MANIFEST, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["bookId", "学段", "学科", "年级", "册次", "版本", "教材标题", "封面本地路径", "下载成功"])
        for bid, _ in tasks:
            p = local_path(bid)
            rel = str(p.relative_to(ROOT)) if p.exists() else ""
            w.writerow([bid, meta.get(bid, {}).get("学段", ""), meta.get(bid, {}).get("学科", ""),
                        meta.get(bid, {}).get("年级", ""), meta.get(bid, {}).get("册次", ""),
                        meta.get(bid, {}).get("版本", ""), meta.get(bid, {}).get("教材标题", ""),
                        rel, results.get(bid, False)])

    # 回写 jsonl 的 封面本地路径
    path_map = {bid: str(local_path(bid).relative_to(ROOT)) for bid, _ in tasks if local_path(bid).exists()}
    out_lines = []
    patched = 0
    with open(JSONL, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            c = json.loads(line)
            body = json.loads(c["正文"])
            bid = body.get("教材bookId") or c.get("来源标识")
            if bid and str(bid) in path_map:
                body["封面本地路径"] = path_map[str(bid)]
                c["正文"] = json.dumps(body, ensure_ascii=False)
                patched += 1
            out_lines.append(json.dumps(c, ensure_ascii=False))
    with open(JSONL, "w", encoding="utf-8") as f:
        for l in out_lines:
            f.write(l + "\n")
    print(f"清单CSV: {MANIFEST}", flush=True)
    print(f"jsonl 回写封面路径: {patched} 条", flush=True)

if __name__ == "__main__":
    main()
