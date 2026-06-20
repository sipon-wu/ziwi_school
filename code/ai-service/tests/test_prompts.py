"""Prompt 模板加载测试"""
import os
import pytest

def test_lesson_plan_prompt_exists():
    """教案生成 Prompt 模板存在"""
    path = "prompts/lesson_plan.txt"
    assert os.path.exists(path), f"模板文件不存在: {path}"
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    assert len(content) > 50, "教案 Prompt 过短"
    # 检查关键占位符
    required_vars = ['{subject}', '{grade}', '{lesson_title}', '{curriculum_standards}']
    for var in required_vars:
        assert var in content, f"缺变量占位符: {var}"

def test_exam_prompt_exists():
    """出题 Prompt 模板存在"""
    path = "prompts/exam_generate.txt"
    assert os.path.exists(path)
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    assert len(content) > 50
    required_vars = ['{subject}', '{grade}', '{knowledge_point}', '{difficulty}', '{count}']
    for var in required_vars:
        assert var in content, f"缺变量占位符: {var}"

def test_xiaowei_chat_prompt():
    """小微对话 Prompt 模板"""
    path = "prompts/xiaowei_chat.txt"
    assert os.path.exists(path)
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    assert '{teacher_name}' in content
    assert '{subject}' in content
    assert '{grade}' in content

def test_prompt_injection():
    """变量注入后无残留占位符"""
    path = "prompts/lesson_plan.txt"
    with open(path, 'r', encoding='utf-8') as f:
        template = f.read()

    filled = template.replace('{subject}', '语文')\
        .replace('{grade}', '四年级')\
        .replace('{lesson_title}', '《观潮》')\
        .replace('{textbook_unit}', '第一单元')\
        .replace('{period}', '1')\
        .replace('{curriculum_standards}', '- [3.2.1] 测试课标')\
        .replace('{format_instruction}', '使用核心素养模板')\
        .replace('{format_template}', 'core_literacy')

    assert '{' not in filled, f"残留未替换占位符: {filled}"
    assert '四年级' in filled
    assert '《观潮》' in filled
    assert '3.2.1' in filled
