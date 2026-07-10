# -*- coding: utf-8 -*-
"""
全量课程包元数据提取器（Workstream A · 元数据扩张）
========================================================
输入：
  - output/bookid_map.jsonl   （税制ID链 → bookId 映射，已由 resolve_bookids_loggedin.cjs 解析）
  - output/底料_元数据_全K12书目清单.json （可选，用于补全版/学科等元数据）
输出：
  - output/底料_课程包_全.jsonl     （课程包级 底料 chunks，逐行一个）
  - output/底料_课程包_全_summary.json （统计报告）

数据源：国家中小学智慧教育平台 公开 API（national_lesson 命名空间，无需登录）
  - details : s-file-N.../zxx/ndrs/national_lesson/teachingmaterials/details/{bookId}.json
  - trees   : s-file-N.../zxx/ndrv2/national_lesson/trees/{bookId}.json
  - parts   : s-file-N.../zxx/ndrs/national_lesson/teachingmaterials/{bookId}/resources/parts.json
  - part_NN : parts.json 返回的 URL 列表
  - 评分    : x-api.ykt.eduyun.cn/proxy/assessment/v1/assessments/actions/query
              ?assessment_ids=...&assessment_type=national_lesson  （带 sdp-app-id 头）

章节名解析：trees 为单元(父)→章节(子) 两级树；课程包的 chapter_ids 含 [单元id, 章节id]，
            用 trees 构建 id→节点(含父节点引用) 映射，章节取叶子节点、单元取其父节点。
"""
import json, csv, hashlib, os, time, urllib.request, urllib.parse, sys
from pathlib import Path

# ---------- 配置 ----------
OUT_DIR = Path("output")
BOOKID_MAP = OUT_DIR / os.environ.get("BOOKID_MAP", "bookid_map_full.jsonl")
OUT_JSONL = OUT_DIR / "底料_课程包_全.jsonl"
OUT_SUMMARY = OUT_DIR / "底料_课程包_全_summary.json"

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
SDP_APP_ID = "e5649925-441d-4a53-b525-51a2f1c4e0a8"

# CDN 镜像轮询，提升健壮性
S_FILE_HOSTS = [
    "s-file-1.ykt.cbern.com.cn",
    "s-file-2.ykt.cbern.com.cn",
    "s-file-3.ykt.cbern.com.cn",
    "s-file-4.ykt.cbern.com.cn",
    "s-file-5.ykt.cbern.com.cn",
]

# 默认只跑小学语文做试点；置为 0 / 空 则跑全部
MAX_BOOKS = int(os.environ.get("MAX_BOOKS", "0")) or None
FILTER_XUEDUAN = os.environ.get("FILTER_XUEDUAN", "小学")
FILTER_XUEKE = os.environ.get("FILTER_XUEKE", "语文")

SLEEP_BETWEEN_BOOKS = 0.4   # 友好限速
SLEEP_BETWEEN_RETRY = 1.5


# ---------- 网络 ----------
def fetch(url, headers=None, timeout=20, retries=2):
    hdrs = {"User-Agent": USER_AGENT}
    if headers:
        hdrs.update(headers)
    last_err = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=hdrs)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                raw = r.read().decode("utf-8")
            return json.loads(raw)
        except Exception as e:
            last_err = e
            time.sleep(SLEEP_BETWEEN_RETRY)
    raise last_err


def fetch_cdn(path, headers=None):
    """在多个 s-file 镜像间轮询抓取同一 path（path 以 /zxx/... 开头）"""
    last_err = None
    for host in S_FILE_HOSTS:
        url = f"https://{host}{path}"
        try:
            return fetch(url, headers=headers)
        except Exception as e:
            last_err = e
    raise last_err


# ---------- 章节树解析 ----------
def build_chapter_index(trees):
    """
    返回：
      by_id: {chapter_id: {"title","path","parent":id_or_None,"is_leaf":bool}}
      path 为 单元/章节 全路径标题
    """
    by_id = {}

    def walk(node, parent_id=None, parent_title=""):
        nid = node.get("id")
        title = node.get("title") or ""
        path = f"{parent_title}/{title}" if parent_title else title
        children = node.get("child_nodes") or []
        by_id[nid] = {
            "title": title,
            "path": path,
            "parent": parent_id,
            "is_leaf": len(children) == 0,
        }
        for c in children:
            walk(c, nid, path)

    for t in trees:
        walk(t)
    return by_id


def resolve_unit_section(chapter_ids, by_id):
    """从课程包的 chapter_ids 推断 单元 + 章节 + 路径"""
    if not chapter_ids:
        return "", "", ""
    nodes = [by_id[c] for c in chapter_ids if c in by_id]
    if not nodes:
        return "", "", ""
    # 章节 = 路径最长的叶子（若都不是叶子，取路径最长者）
    leaf_nodes = [n for n in nodes if n["is_leaf"]]
    pick = (leaf_nodes or nodes)[-1]
    section = pick["title"]
    section_path = pick["path"]
    # 单元 = 章节节点的直接父（若存在）
    unit = ""
    if pick["parent"] and pick["parent"] in by_id:
        unit = by_id[pick["parent"]]["title"]
    # 若章节本身即单元（无父），则单元=章节、章节留空
    if not unit:
        # 尝试取该章节所属更高层：若 chapter_ids 有多级，父级即单元
        if len(nodes) >= 2:
            unit = nodes[0]["title"]
            section = nodes[-1]["title"]
            section_path = nodes[-1]["path"]
    # 兜底：综合性学习等扁平化活动节点（parent=None）时，
    # 用「子单元标题是章节标题子串」反推单元，如 "我爱你，汉字" ⊂ "展示交流（我爱你，汉字）"
    if not unit and section:
        for nid, n in by_id.items():
            if (not n["is_leaf"]) and n["title"] and (n["title"] in section):
                unit = n["title"]
                break
    return unit, section, section_path


# ---------- 评分 ----------
def fetch_ratings(lesson_ids):
    """分批拉取评分；返回 {lesson_id: {"avg","total"}}"""
    stats = {}
    if not lesson_ids:
        return stats
    batch_size = 40
    for i in range(0, len(lesson_ids), batch_size):
        batch_ids = lesson_ids[i:i + batch_size]
        ids_param = ",".join(batch_ids)
        url = (f"https://x-api.ykt.eduyun.cn/proxy/assessment/v1/assessments/actions/query"
               f"?assessment_ids={urllib.parse.quote(ids_param)}&assessment_type=national_lesson")
        try:
            data = fetch(url, headers={"sdp-app-id": SDP_APP_ID})
            # data 可能是 list 或 dict；兼容处理
            items = data if isinstance(data, list) else data.get("items") or data.get("data") or []
            for s in items:
                aid = s.get("assessment_id") or s.get("id")
                if aid:
                    stats[aid] = {
                        "avg": s.get("average"),
                        "total": s.get("total"),
                    }
        except Exception as e:
            print(f"    [warn] 评分批次失败: {e}")
    return stats


# ---------- chunk 生成 ----------
def chunk_id(xd, xk, nj, ce, bb, unit, section, title):
    s = f"{xd}|{xk}|{nj}|{ce}|{bb}|{unit}|{section}|{title}"
    return hashlib.sha1(s.encode("utf-8")).hexdigest()[:16]


def make_chunk(meta, unit, section, section_path, lesson, rating):
    xd = meta.get("学段", "")
    xk = meta.get("学科", "")
    nj = meta.get("年级", "")
    ce = meta.get("册次", "")
    bb = meta.get("版本", "")
    oldnew = meta.get("新旧教材", "")

    teachers = [t.get("name", "") for t in lesson.get("teacher_list", []) if t.get("name")]
    providers = [p.get("name", "") for p in lesson.get("provider_list", []) if p.get("name")]
    title = lesson.get("title", "")

    avg = rating.get("avg", "") if rating else ""
    total = rating.get("total", "") if rating else ""

    body = {
        "课程包标题": title,
        "所属单元": unit,
        "所属章节": section,
        "章节路径": section_path,
        "教师": "、".join(teachers),
        "提供方": "、".join(providers),
        "学习时长(秒)": lesson.get("custom_properties", {}).get("study_time", ""),
        "平均评分": avg,
        "评价数": total,
        "新旧教材": oldnew,
    }

    cid = chunk_id(xd, xk, nj, ce, bb, unit, section, title)
    kg_unit = f"kg_{xk}_{bb}_{nj}_{ce}#{unit}" if (xk and bb and nj and ce) else ""
    return {
        "chunk_id": cid,
        "学段": xd,
        "学科": xk,
        "年级": nj,
        "册别": ce,
        "版本": bb,
        "新旧教材": oldnew,
        "单元": unit,
        "章节": section,
        "来源类型": "课程包",
        "来源标识": f"national_lesson:{lesson.get('id','')}",
        "正文": json.dumps(body, ensure_ascii=False),
        "关联课标条目": [],
        "关联KG单元": kg_unit,
        "版权标识": "内部教研参照",
    }


# ---------- 单本处理 ----------
def process_book(meta):
    book_id = meta.get("bookId")
    if not book_id:
        return [], "no_bookId"
    try:
        # 1. trees（章节名映射）
        trees = fetch_cdn(f"/zxx/ndrv2/national_lesson/trees/{book_id}.json")
        by_id = build_chapter_index(trees)

        # 2. parts → part_NN
        parts = fetch_cdn(f"/zxx/ndrs/national_lesson/teachingmaterials/{book_id}/resources/parts.json")
        # parts 可能是 URL 列表，也可能是含 part 列表的对象
        part_urls = parts if isinstance(parts, list) else (parts.get("parts") or parts.get("items") or [])

        lessons = []
        for pu in part_urls:
            # pu 可能是完整 URL 或相对 path
            if pu.startswith("http"):
                pd = fetch(pu)
            else:
                pd = fetch_cdn(pu if pu.startswith("/") else f"/zxx/ndrs/national_lesson/teachingmaterials/{book_id}/resources/{pu}")
            if isinstance(pd, list):
                lessons.extend(pd)
            elif isinstance(pd, dict):
                lessons.extend(pd.get("items") or pd.get("data") or [])

        # 3. 评分
        ratings = fetch_ratings([l.get("id") for l in lessons if l.get("id")])

        # 4. chunks
        chunks = []
        for les in lessons:
            unit, section, section_path = resolve_unit_section(les.get("chapter_ids", []), by_id)
            rating = ratings.get(les.get("id"), {})
            chunks.append(make_chunk(meta, unit, section, section_path, les, rating))

        return chunks, None
    except Exception as e:
        return [], f"ERR:{e}"


# ---------- 主流程 ----------
def main():
    OUT_DIR.mkdir(exist_ok=True)
    if not BOOKID_MAP.exists():
        print("缺少 bookid_map.jsonl，请先运行 resolve_bookids_loggedin.cjs")
        sys.exit(1)

    books = []
    with open(BOOKID_MAP, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            books.append(json.loads(line))

    # 过滤
    if FILTER_XUEDUAN:
        books = [b for b in books if b.get("学段") == FILTER_XUEDUAN]
    if FILTER_XUEKE:
        books = [b for b in books if b.get("学科") == FILTER_XUEKE]
    if MAX_BOOKS:
        books = books[:MAX_BOOKS]

    # 按 bookId 去重（避免 新旧教材 维度在平台未拆分导致的重复抓取）
    seen = set()
    deduped = []
    dup = 0
    for b in books:
        bid = b.get("bookId")
        if bid in seen:
            dup += 1
            continue
        seen.add(bid)
        deduped.append(b)
    books = deduped
    if dup:
        print(f"(已去重 {dup} 个重复 bookId)", flush=True)

    print(f"待处理教材数: {len(books)}", flush=True)

    all_chunks = []
    per_book = []
    # 增量写：先以写入模式打开，每本处理完立即追加并 flush，避免中断丢数据
    with open(OUT_JSONL, "w", encoding="utf-8") as fout:
        for i, meta in enumerate(books, 1):
            label = f"{meta.get('学段')}/{meta.get('学科')}/{meta.get('版本')}/{meta.get('年级')}/{meta.get('册次')}/{meta.get('新旧教材')}"
            print(f"[{i}/{len(books)}] {label}  bookId={meta.get('bookId')}", flush=True)
            chunks, err = process_book(meta)
            if err:
                print(f"    ! 失败: {err}", flush=True)
                per_book.append({"label": label, "bookId": meta.get("bookId"), "chunks": 0, "error": err})
            else:
                print(f"    ✓ 课程包 chunks: {len(chunks)}", flush=True)
                all_chunks.extend(chunks)
                for c in chunks:
                    fout.write(json.dumps(c, ensure_ascii=False) + "\n")
                fout.flush()
                per_book.append({"label": label, "bookId": meta.get("bookId"), "chunks": len(chunks), "error": None})
            time.sleep(SLEEP_BETWEEN_BOOKS)

    # 统计
    summary = {
        "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "filter": {"学段": FILTER_XUEDUAN, "学科": FILTER_XUEKE, "max_books": MAX_BOOKS},
        "books_total": len(books),
        "books_ok": sum(1 for b in per_book if not b["error"]),
        "books_failed": sum(1 for b in per_book if b["error"]),
        "chunks_total": len(all_chunks),
        "per_book": per_book,
    }
    with open(OUT_SUMMARY, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    print(f"\n完成：{summary['books_ok']}/{len(books)} 本成功，"
          f"共 {len(all_chunks)} 个课程包 chunks")
    print(f"输出: {OUT_JSONL}")
    print(f"报告: {OUT_SUMMARY}")


if __name__ == "__main__":
    main()
