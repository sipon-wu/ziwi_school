#!/usr/bin/env python3
"""把 ai-service/assets/index.json 的装饰元件库采集进 materials 表。

背景（见 cmd/seed/full/main.go 的 21 条 decor_element 占位）：
  平台真正的装饰元件库是 assets/index.json 声明的 2571 个 svg-mono 图标
  （Tabler + RemixIcon），外加 assets/svg/ 下 3182 个真实 SVG。但此前**从未**
  把这些资产灌进 materials 表，导致素材库 / /decor 接口 / CoursewareBuilder
  的 resolveDecorUrl 只能命中 21 条手写占位图 —— 这就是"素材库不够 / 色彩单一"的根因。

本脚本补齐"采集"这一步：本地读 index.json + svg/，生成可应用的 SQL，复用
export_seed_sql.py 的列集与转义，decor_facets 写合法 JSON 数组，不再踩
（对象数组误写 decor_facets 导致 ListMaterials 全失败）的坑。

SVG 内联为 dataURL（与现有 21 条占位图同款做法），零基础设施改动、不碰
ai-service 部署即可渲染；后续若要瘦身，改 url 为静态托管路径即可。

应用方式（与 export_seed_sql.py 一致，staging postgres 只在 docker 网络内）：
    python scripts/ingest_decor_assets.py -o /tmp/decor.sql
    scp /tmp/decor.sql root@<server>:/tmp/decor.sql
    ssh root@<server> 'cd /opt/zhiwei/code/deploy && set -a && . ./.env.staging && set +a && \
        docker exec -i zhiwei-postgres-staging psql -U "$DB_USER" -d "$DB_NAME" \
        -v ON_ERROR_STOP=1 < /tmp/decor.sql'
"""
import argparse
import json
import os
import sys
import urllib.parse

# index.json 枚举：styles / scenes / grades / subjects 的下标 → 中文受控词。
# motif_root / color_root 与前端 cwTemplate STYLE_LABELS / COLOR_FAMILIES 同源，
# 也是素材库列表页 MaterialItem 展示用的中文 chip（见 frontend Materials.tsx）。
STYLE_MOTIF = {
    "forest": "森林", "minimal": "极简", "academic": "严谨", "cartoon": "卡通",
    "tech": "科技", "fresh": "清新", "china": "国风", "flat": "扁平",
    "business": "商务", "basic": "通用",
}
STYLE_COLOR_FAMILY = {
    "forest": "青绿系", "minimal": "灰系", "academic": "蓝系", "cartoon": "多彩渐变",
    "tech": "蓝系", "fresh": "青绿系", "china": "红金系", "flat": "灰系",
    "business": "蓝系", "basic": "灰系",
}
SCHOOL_ID = os.getenv("CW_SEED_SCHOOL_ID", "sch-0001")
# 默认只采集装饰/图标/学科三类可视元件（index.json categories=[decor,subject,icon]）。
CATEGORY_NAMES = {0: "decor", 1: "subject", 2: "icon"}


def esc(s) -> str:
    """SQL 字符串字面量转义：单引号翻倍。"""
    return str(s).replace("'", "''")


def data_url(svg: str) -> str:
    """把 SVG 文本包成 dataURL（与 main.go 占位图同款，零静态托管依赖）。"""
    return "data:image/svg+xml;utf8," + urllib.parse.quote(svg.strip())


def main():
    ap = argparse.ArgumentParser(description="assets/index.json → materials seed.sql（无 DB 连接）")
    ap.add_argument("-o", "--out", default="", help="输出文件（默认 stdout）")
    ap.add_argument("--asset-dir", default="", help="assets 目录（默认脚本上级的 assets/）")
    args = ap.parse_args()

    here = os.path.dirname(os.path.abspath(__file__))
    asset_dir = args.asset_dir or os.path.join(os.path.dirname(here), "assets")
    index_path = os.path.join(asset_dir, "index.json")
    svg_dir = os.path.join(asset_dir, "svg")
    with open(index_path, encoding="utf-8") as fh:
        catalog = json.load(fh)

    enums = catalog.get("enums", {})
    styles = enums.get("styles", [])
    # categories 下标 → 本脚本只取可视元件类（全部进 decor_element 表，供装饰/图标复用）
    n = 0
    lines = ["BEGIN;"]

    for a in catalog.get("assets", []):
        aid = a.get("id", "")
        name = a.get("name", aid)
        if not aid:
            continue
        # 风格：取下标对应中文母题/色系（svg-mono 可着色，色系仅作筛选默认值）
        st = a.get("st", []) or [0]
        style = styles[st[0]] if st and st[0] < len(styles) else "basic"
        motif_root = STYLE_MOTIF.get(style, "通用")
        color_root = STYLE_COLOR_FAMILY.get(style, "灰系")

        # URL：优先取 line 变体（v.l），缺失回退 fill（v.f），再回退占位
        v = a.get("v", {}) or {}
        rel = v.get("l") or v.get("f") or ""
        url = ""
        if rel:
            svg_path = os.path.join(svg_dir, os.path.basename(rel))
            try:
                with open(svg_path, encoding="utf-8") as sf:
                    url = data_url(sf.read())
            except OSError:
                url = ""  # 文件缺失则留空，前端回落 inline snapshot，不破图

        facets = [
            f"motif.{motif_root}",
            f"color.{color_root}",
            "page_type.content",
            "applicable.common",
        ]
        decor_facets = json.dumps(facets, ensure_ascii=False)

        # 复刻 export_seed_sql.py 的列集，保证 schema 一致
        delete = f"DELETE FROM materials WHERE id='{esc(aid)}' AND category='decor_element';"
        insert = (
            "INSERT INTO materials "
            "(id, school_id, user_id, name, type, format, size, tag, url, content, "
            " h5_html, interactive_slots, status, grade, subject, theme_id, category, "
            " decor_facets, applicable, motif_root, color_root, page_type, parent_ids, "
            " ai_generated, ai_model_version, human_edited, created_at, updated_at) "
            "VALUES "
            f"('{esc(aid)}', '{SCHOOL_ID}', '', '{esc(name)}', 'image', "
            f"'common', '1KB', '装饰元件', '{esc(url)}', '', "
            f"'', '', 'active', '', '', '', 'decor_element', "
            f"'{esc(decor_facets)}', 'common', '{esc(motif_root)}', '{esc(color_root)}', 'content', '[]', "
            f"FALSE, '', FALSE, now(), now());"
        )
        lines.append(delete)
        lines.append(insert)
        n += 1

    lines.append("COMMIT;")
    sql = "\n".join(lines) + "\n"

    if args.out:
        with open(args.out, "w", encoding="utf-8") as fh:
            fh.write(sql)
        print(f"已写入 {args.out}（{n} 条 decor_element）", file=sys.stderr)
    else:
        sys.stdout.write(sql)


if __name__ == "__main__":
    main()
