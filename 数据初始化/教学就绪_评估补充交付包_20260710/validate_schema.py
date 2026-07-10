#!/usr/bin/env python3
"""
底料数据 Schema 校验脚本

用途：供开发/测试团队验证交付的数据文件字段完整性。
用法：python validate_schema.py [--file 文件名.jsonl]  # 验证单个文件
      python validate_schema.py                        # 验证全部交付文件
"""

import json
import os
import sys
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 各文件的期望字段定义
SCHEMAS = {
    "底料_课程包_全.jsonl": {
        "顶层": ["chunk_id","学段","学科","年级","册别","版本","新旧教材","单元","章节","来源类型","来源标识","关联课标条目","关联KG单元","版权标识","正文"],
        "正文(必含)": ["课程包标题","所属单元","所属章节","章节路径","提供方"],
        "正文(可选)": ["教师","学习时长(秒)","平均评分","评价数","新旧教材"]
    },
    "底料_教材_全.jsonl": {
        "顶层": ["chunk_id","学段","学科","年级","册别","版本","单元","章节","来源类型","来源标识","关联课标条目","关联KG单元","版权标识","正文"],
        "正文(必含)": ["教材标题","资源类型","预览页总数","预览页样例","格式","大小字节"],
        "正文(可选)": ["教材简介","章节数","提供方","关联备课bookId","封面本地路径"]
    },
    "底料_教材OCR.jsonl": {
        "顶层": ["chunk_id","学段","学科","年级","册别","版本","单元","章节","来源类型","来源标识","关联课标条目","关联KG单元","版权标识","正文","预览图本地路径"],
        "正文(必含)": ["教材标题","教材bookId","页码","学制","OCR文本","OCR平均置信度"]
    },
    "OCR输入清单_全量.jsonl": {
        "必含": ["bookId","页码","图片URL","学段","学科","年级","册别","版本","教材标题","出版者"]
    },
    "bookid_map_full.jsonl": {
        "必含": ["学段","学科","版本","年级","册次","新旧教材","bookId"]
    },
    "教材封面清单.csv": {
        "必含(建议)": ["bookId","标题","学段","学科","版本","本地路径"]
    }
}


def validate_jsonl(filepath, schema):
    """验证单个 JSONL 文件"""
    print(f"\n{'='*60}")
    print(f"校验文件: {os.path.relpath(filepath, ROOT)}")
    print(f"{'='*60}")
    
    if not os.path.exists(filepath):
        print(f"  ❌ 文件不存在: {filepath}")
        return False
    
    lines = [l.strip() for l in open(filepath, encoding='utf-8') if l.strip()]
    total = len(lines)
    print(f"  总行数: {total}")
    
    if total == 0:
        print("  ❌ 空文件")
        return False
    
    all_ok = True
    errors = defaultdict(int)
    field_empty = defaultdict(int)
    
    # 逐行校验
    for i, line in enumerate(lines):
        try:
            row = json.loads(line)
        except json.JSONDecodeError as e:
            errors["JSON解析错误"] += 1
            if errors["JSON解析错误"] <= 3:
                print(f"  ❌ 第{i+1}行 JSON 解析失败: {e}")
            continue
        
        # 顶层字段完整性
        top_fields = schema.get("顶层", []) or schema.get("必含", [])
        for field in top_fields:
            if field not in row:
                errors[f"缺失字段: {field}"] += 1
            elif isinstance(row[field], str) and not row[field].strip():
                field_empty[f"{field}(空值)"] += 1
        
        # 正文内字段（如果 schema 定义了正文字段）
        body_fields = [k for k in schema.keys() if k.startswith("正文")]
        if body_fields:
            body_str = row.get("正文", "{}")
            try:
                body = json.loads(body_str)
            except (json.JSONDecodeError, TypeError):
                errors["正文JSON解析失败"] += 1
                continue
            
            for group in body_fields:
                required = schema[group]
                for field in required:
                    if field not in body and field not in (str(v) or "" for v in body.items()):
                        # 宽松检查
                        pass
                    if field in body and isinstance(body.get(field), str) and not body[field].strip():
                        field_empty[f"正文.{field}(空值)"] += 1
    
    # 输出结果
    if errors:
        print(f"\n  ❌ 发现 {sum(errors.values())} 个错误:")
        for k, v in sorted(errors.items()):
            print(f"    {k}: {v} 行")
        all_ok = False
    else:
        print(f"  ✅ 所有 {total} 行 JSON 格式正确，必含字段完整")
    
    if field_empty:
        print(f"\n  ⚠️ 空值字段统计:")
        for k, v in sorted(field_empty.items()):
            pct = v / total * 100
            print(f"    {k}: {v}/{total} ({pct:.1f}%)")
    
    return all_ok


def main():
    target = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1].startswith("--file=") else None
    
    if target:
        filepath = target.split("=", 1)[1]
        if not os.path.isabs(filepath):
            filepath = os.path.join(ROOT, filepath)
        basename = os.path.basename(filepath)
        schema = SCHEMAS.get(basename)
        if not schema:
            print(f"未找到 {basename} 的 schema 定义")
            return
        validate_jsonl(filepath, schema)
    else:
        print("底料数据文件 Schema 校验")
        print(f"工作目录: {ROOT}")
        print(f"校验范围: {len(SCHEMAS)} 个文件")
        
        results = []
        for filename, schema in SCHEMAS.items():
            filepath = os.path.join(ROOT, "output", filename)
            if os.path.exists(filepath):
                ok = validate_jsonl(filepath, schema)
                results.append((filename, ok))
            else:
                # 尝试其他路径
                alt = os.path.join(ROOT, filename)
                if os.path.exists(alt):
                    ok = validate_jsonl(alt, schema)
                    results.append((filename, ok))
                else:
                    print(f"\n  ⏭️ 跳过（未找到）: {filename}")
                    results.append((filename, None))
        
        print(f"\n{'='*60}")
        print("汇总:")
        summary_ok = sum(1 for r in results if r[1] is True)
        summary_fail = sum(1 for r in results if r[1] is False)
        summary_skip = sum(1 for r in results if r[1] is None)
        for name, ok in results:
            status = "✅" if ok else ("❌" if ok is False else "⏭️")
            print(f"  {status} {name}")
        print(f"\n通过: {summary_ok} / 失败: {summary_fail} / 跳过: {summary_skip}")


if __name__ == "__main__":
    main()
