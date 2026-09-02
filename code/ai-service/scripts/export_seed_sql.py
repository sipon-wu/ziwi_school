#!/usr/bin/env python3
"""把产物目录（md + meta.json）转成 seed.sql —— 无需数据库连接。

staging 的 postgres 只在 docker 网络内、没有宿主端口映射，本地 psycopg2
直连不可行。这里在本地把产物转成 SQL，再通过远程 docker exec psql 执行：

    python scripts/export_seed_sql.py output/seed -o /tmp/seed.sql
    scp /tmp/seed.sql root@<server>:/tmp/seed.sql
    ssh root@<server> 'cd /opt/zhiwei/code/deploy && set -a && . ./.env.staging && set +a && \
        docker exec -i zhiwei-postgres-staging psql -U "$DB_USER" -d "$DB_NAME" \
        -v ON_ERROR_STOP=1 < /tmp/seed.sql'

字段与 generate_seed_coursewares.py 的 upsert_material 保持一致，
防止两处 schema 各写一套。
"""
import argparse
import glob
import json
import os
import sys

THEME_BY_STYLE = {
    "china": "zgf-ink-wash",
    "tech": "te-quantum-blue",
    "fresh": "fr-mint",
    "academic": "aca-edu-blue",
    "cartoon": "sp-cartoon",
    "minimal": "min-classic-blue",
}
# motif_root / color_root 是列表页展示字段（前端 MaterialItem 把二者当中文
# chip 文本显示，见 frontend Materials.tsx：`· {motif_root} · {color_root}`）。
# 二者都是 facet 受控词表（与 cwTemplate COLOR_FAMILIES / STYLE_LABELS 同源），
# 不是 hex、也不是 JSON——varchar(40) 也装得下中文标签。
# color_root 取"色系一级"中文（蓝系/青绿系/红金系/...），按风格映射。
STYLE_MOTIF = {
    "china": "国风",
    "fresh": "清新",
    "tech": "科技",
    "academic": "学术",
    "cartoon": "卡通",
    "minimal": "极简",
}
STYLE_COLOR_FAMILY = {
    "china": "红金系",
    "tech": "蓝系",
    "fresh": "青绿系",
    "academic": "蓝系",
    "cartoon": "多彩渐变",
    "minimal": "灰系",
}
SCHOOL_ID = os.getenv("CW_SEED_SCHOOL_ID", "sch-0001")
MODEL = os.getenv("CW_SEED_MODEL", "qwen-plus")


def esc(s) -> str:
    """SQL 字符串字面量转义：单引号翻倍。"""
    return str(s).replace("'", "''")


def row_sql(md_path: str, meta_path: str) -> list:
    """生成某套课件的 SQL 语句（DELETE 覆盖 + INSERT）。"""
    with open(md_path, encoding="utf-8") as fh:
        content = fh.read()
    with open(meta_path, encoding="utf-8") as fh:
        m = json.load(fh)

    name = m.get("name", "")
    subject = m.get("subject", "")
    grade = m.get("grade", "")
    fmt = m.get("format", "ppt")
    style = m.get("style", "minimal")
    theme = THEME_BY_STYLE.get(style, "min-classic-blue")
    color_root = STYLE_COLOR_FAMILY.get(style, "蓝系")
    motif_root = STYLE_MOTIF.get(style, "极简")
    # decor_facets 是 facet 路径字符串数组（model.DecorFacets=[]string，Scan 按
    # JSON 字符串数组解析）；不能塞 decor_refs 对象数组，否则 GORM 扫描报错导致
    # ListMaterials 整体失败、课件库显示为空。
    facets = [f"motif.{motif_root}", f"color.{color_root}", f"applicable.{fmt}"]
    decor_facets = json.dumps(facets, ensure_ascii=False)
    tag = f"{subject}{grade}"

    delete = f"DELETE FROM materials WHERE name='{esc(name)}' AND type='courseware';"
    insert = (
        "INSERT INTO materials "
        "(id, school_id, user_id, name, type, format, size, tag, url, content, "
        " h5_html, interactive_slots, status, grade, subject, theme_id, category, "
        " decor_facets, applicable, motif_root, color_root, page_type, parent_ids, "
        " ai_generated, ai_model_version, human_edited, created_at, updated_at) "
        "VALUES "
        f"(gen_random_uuid(), '{SCHOOL_ID}', NULL, '{esc(name)}', 'courseware', "
        f"'{esc(fmt)}', '', '{esc(tag)}', '', '{esc(content)}', "
        f"'', '', 'active', '{esc(grade)}', '{esc(subject)}', '{theme}', 'courseware', "
        f"'{esc(decor_facets)}', '', '{esc(motif_root)}', '{esc(color_root)}', '', '[]', "
        f"TRUE, '{MODEL}', FALSE, now(), now());"
    )
    return [delete, insert]


def main():
    ap = argparse.ArgumentParser(description="产物目录 → seed.sql（无需 DB 连接）")
    ap.add_argument("dir", help="产物目录（含 *.md 与 *.meta.json）")
    ap.add_argument("-o", "--out", default="", help="输出文件（默认 stdout）")
    args = ap.parse_args()

    metas = sorted(glob.glob(os.path.join(args.dir, "*.meta.json")))
    if not metas:
        print("未找到 *.meta.json", file=sys.stderr)
        sys.exit(1)

    lines = ["BEGIN;"]
    for mp in metas:
        base = mp[: -len(".meta.json")]
        md = base + ".md"
        if not os.path.exists(md):
            print(f"跳过（缺 {md}）", file=sys.stderr)
            continue
        for stmt in row_sql(md, mp):
            lines.append(stmt)
    lines.append("COMMIT;")

    sql = "\n".join(lines) + "\n"
    if args.out:
        with open(args.out, "w", encoding="utf-8") as fh:
            fh.write(sql)
        print(f"已写入 {args.out}（{len(metas)} 套）", file=sys.stderr)
    else:
        sys.stdout.write(sql)


if __name__ == "__main__":
    main()
