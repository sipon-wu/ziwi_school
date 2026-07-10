# -*- coding: utf-8 -*-
"""
extract_textbooks.py —— 教材层底料提取（tch_material 命名空间）

目标：覆盖「无备课包」的教材书目。
国家平台教材（电子教材/主题课程）记录在 tch_material 命名空间，4 个公开分片，
每条记录自带：学段/学科/年级/册次/版本 税制标签 + 教材 bookId(global_resource_id)
+ 教材标题 + 简介 + 章节树(部分) + 公开 JPG 预览页。

与正在后台跑的「备课课程包层」(prepare_lesson, 2931 本, 课程包级) 互补：
- 备课课程包层：书里"有备课包"的那部分，含 课件/教学设计/视频 文本 + 教师/评分（更丰富）
- 教材层：ALL 教材（含无备课包），提供 教材注册表 + 结构 + 预览图链接（保证不漏书）

输出：
  output/底料_教材_全.jsonl        —— 教材级底料 chunks
  output/底料_教材_全_summary.json  —— 统计摘要
"""
import os, sys, json, time, hashlib, urllib.request
from pathlib import Path
from collections import Counter

OUT_DIR = Path("output")
RAW_CACHE = OUT_DIR / "raw_tch_material.json"
OUT_JSONL = OUT_DIR / "底料_教材_全.jsonl"
OUT_SUMMARY = OUT_DIR / "底料_教材_全_summary.json"

TM_PARTS = [
    "https://s-file-2.ykt.cbern.com.cn/zxx/ndrs/resources/tch_material/part_100.json",
    "https://s-file-2.ykt.cbern.com.cn/zxx/ndrs/resources/tch_material/part_101.json",
    "https://s-file-1.ykt.cbern.com.cn/zxx/ndrs/resources/tch_material/part_102.json",
    "https://s-file-1.ykt.cbern.com.cn/zxx/ndrs/resources/tch_material/part_103.json",
]
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
SLEEP = 0.15
COPYRIGHT = "教育部资源中心；未经允许不得转载或引用"


def fetch(url, timeout=30, retries=3):
    last = None
    for _ in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            last = e
            time.sleep(1)
    raise last


def load_raw():
    """抓取并缓存 tch_material 原始记录（4 分片）。"""
    if RAW_CACHE.exists():
        print(f"[cache] 读取缓存 {RAW_CACHE}", flush=True)
        return json.loads(RAW_CACHE.read_text(encoding="utf-8"))
    recs = []
    for u in TM_PARTS:
        try:
            r = fetch(u)
            if isinstance(r, list):
                recs += r
            print(f"  [200] {u.split('/')[-1]} 记录={len(r) if isinstance(r, list) else 'n/a'}", flush=True)
        except Exception as e:
            print(f"  [ERR] {u} {e}", flush=True)
        time.sleep(SLEEP)
    RAW_CACHE.write_text(json.dumps(recs, ensure_ascii=False), encoding="utf-8")
    print(f"[cache] 已缓存 {len(recs)} 条 -> {RAW_CACHE}", flush=True)
    return recs


def tag_map(rec):
    return {t["tag_dimension_id"]: t["tag_name"] for t in (rec.get("tag_list") or [])}


def build_chunk(rec):
    tg = tag_map(rec)
    学段 = tg.get("zxxxd", "")
    学科 = tg.get("zxxxk", "")
    年级 = tg.get("zxxnj", "")
    册别 = tg.get("zxxcc", "")
    版本 = tg.get("zxxbb", "")
    book_id = (rec.get("custom_properties") or {}).get("global_resource_id") or rec.get("id")
    标题 = (rec.get("global_title") or {}).get("zh-CN") or rec.get("title") or ""
    cp = rec.get("custom_properties") or {}
    简介 = cp.get("global_summary") or (rec.get("global_description") or {}).get("zh-CN") or ""
    if isinstance(简介, dict):
        简介 = 简介.get("zh-CN", "")
    rt = rec.get("resource_type_code", "")
    来源类型 = "教材-主题课程" if rt == "thematic_course" else "教材-电子教材"
    # 章节树
    ct = (rec.get("resource_structure") or {}).get("chapter_tree") or {}
    章节数 = len(ct) if isinstance(ct, dict) else 0
    # 预览图（公开 JPG）
    preview = cp.get("preview") or {}
    if isinstance(preview, dict):
        preview_urls = [v for v in preview.values() if isinstance(v, str) and v.startswith("http")]
    else:
        preview_urls = []
    预览总数 = len(preview_urls)
    预览样例 = preview_urls[:3]
    # 提供方
    provs = rec.get("provider_list") or []
    提供方 = "、".join([p.get("name", "") for p in provs if isinstance(p, dict) and p.get("name")]) or (rec.get("provider") or "")
    # 备课关联（用于与课程包层 JOIN）
    teach_ids = rec.get("teachmeterial_ids") or []

    正文 = {
        "教材标题": 标题,
        "教材简介": 简介,
        "资源类型": rt,
        "章节数": 章节数,
        "提供方": 提供方,
        "预览页总数": 预览总数,
        "预览页样例": 预览样例,
        "关联备课bookId": teach_ids,
        "格式": cp.get("format", ""),
        "大小字节": cp.get("size", ""),
    }
    chunk = {
        "chunk_id": hashlib.sha1(("tm|" + str(book_id)).encode("utf-8")).hexdigest(),
        "学段": 学段,
        "学科": 学科,
        "年级": 年级,
        "册别": 册别,
        "版本": 版本,
        "单元": "",
        "章节": 标题,
        "来源类型": 来源类型,
        "来源标识": book_id,
        "正文": json.dumps(正文, ensure_ascii=False),
        "关联课标条目": "",
        "关联KG单元": "",
        "版权标识": COPYRIGHT,
    }
    return chunk


def main():
    recs = load_raw()
    # 去重（按教材 bookId）
    seen = set()
    chunks = []
    dropped = 0
    for r in recs:
        bid = (r.get("custom_properties") or {}).get("global_resource_id") or r.get("id")
        if not bid:
            dropped += 1
            continue
        if bid in seen:
            continue
        seen.add(bid)
        chunks.append(build_chunk(r))

    print(f"\n原始记录: {len(recs)}  去重后教材: {len(chunks)}  丢弃(无bookId): {dropped}", flush=True)

    with open(OUT_JSONL, "w", encoding="utf-8") as f:
        for c in chunks:
            f.write(json.dumps(c, ensure_ascii=False) + "\n")

    summary = {
        "教材总数": len(chunks),
        "学段分布": dict(Counter(c["学段"] for c in chunks)),
        "学科分布": dict(Counter(c["学科"] for c in chunks).most_common(30)),
        "年级分布": dict(Counter(c["年级"] for c in chunks)),
        "册别分布": dict(Counter(c["册别"] for c in chunks)),
        "来源类型分布": dict(Counter(c["来源类型"] for c in chunks)),
        "含章节树(章节数>0)": sum(1 for c in chunks if json.loads(c["正文"]).get("章节数", 0) > 0),
        "含预览图": sum(1 for c in chunks if json.loads(c["正文"]).get("预览页总数", 0) > 0),
        "含简介": sum(1 for c in chunks if json.loads(c["正文"]).get("教材简介")),
    }
    OUT_SUMMARY.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print("摘要:", json.dumps(summary, ensure_ascii=False, indent=2), flush=True)
    print(f"写出 -> {OUT_JSONL}", flush=True)


if __name__ == "__main__":
    main()
