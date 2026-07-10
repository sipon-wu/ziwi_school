# -*- coding: utf-8 -*-
"""
从公开 part 文件提取全量 bookId 映射（无需登录/浏览器）
数据源：s-file-N.../zxx/ndrs/prepare_lesson/teachingmaterials/part_100|101|102.json
每个课程包记录的 custom_properties.global_resource_id = 教材 bookId（teachingmaterialId）
记录的 tag_list 含 学段/学科/年级/册次/版本/新旧教材 税制维度

输出：output/bookid_map_full.jsonl
      每行: {学段,学科,版本,年级,册次,新旧教材,税制ID链,bookId,defaultTag,记录数}
说明：part 样本覆盖「有备课课程包的教材」，去重后约 2900+ 本，横跨全 K12 全学科。
      该集合已验证覆盖浏览器解析的 小学语文 17/17 本，可作为权威 bookId 源。
"""
import json, urllib.request
from pathlib import Path
from collections import defaultdict

UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
OUT_DIR=Path("output")
OUT=OUT_DIR/"bookid_map_full.jsonl"

DIM_NAME={"zxxxd":"学段","zxxxk":"学科","zxxnj":"年级","zxxcc":"册次","zxxbb":"版本","zxxxjjc":"新旧教材"}

def get(u):
    req=urllib.request.Request(u, headers={"User-Agent":UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))

def main():
    OUT_DIR.mkdir(exist_ok=True)
    book_map={}  # bookId -> info
    for h in ["s-file-1","s-file-2","s-file-3","s-file-4","s-file-5"]:
        for f in ["part_100.json","part_101.json","part_102.json"]:
            url=f"https://{h}.ykt.cbern.com.cn/zxx/ndrs/prepare_lesson/teachingmaterials/{f}"
            try:
                recs=get(url)
            except Exception:
                continue
            if not isinstance(recs, list):
                continue
            for r in recs:
                cp=r.get("custom_properties") or {}
                bid=cp.get("global_resource_id")
                if not bid:
                    continue
                tg={t["tag_dimension_id"]:t["tag_name"] for t in (r.get("tag_list") or [])}
                tid_chain=[t.get("tag_id") for t in (r.get("tag_list") or []) if t.get("tag_dimension_id") in DIM_NAME]
                info={
                    "学段":tg.get("zxxxd",""),
                    "学科":tg.get("zxxxk",""),
                    "年级":tg.get("zxxnj",""),
                    "册次":tg.get("zxxcc",""),
                    "版本":tg.get("zxxbb",""),
                    "新旧教材":tg.get("zxxxjjc",""),
                    "税制ID链":tid_chain,
                    "bookId":bid,
                    "defaultTag":"/".join(tid_chain),
                    "记录数":0,
                }
                if bid not in book_map:
                    book_map[bid]=info
                book_map[bid]["记录数"]+=1

    # 写 jsonl（按 学段/学科/年级/册次 排序便于阅读）
    items=list(book_map.values())
    items.sort(key=lambda x:(x["学段"],x["学科"],x["年级"],x["册次"],x["版本"]))
    with open(OUT,"w",encoding="utf-8") as fo:
        for it in items:
            fo.write(json.dumps(it, ensure_ascii=False)+"\n")

    print(f"已写出全量 bookId 映射: {len(items)} 本 → {OUT}")
    # 简单统计
    from collections import Counter
    print("学段:", dict(Counter(i["学段"] for i in items)))
    print("学科数(top10):", dict(Counter(i["学科"] for i in items).most_common(10)))

if __name__=="__main__":
    main()
