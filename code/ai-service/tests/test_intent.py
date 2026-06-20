"""意图识别单元测试"""
import pytest
import sys
sys.path.insert(0, '.')

from api_server import _detect_intent

def test_lesson_plan_intent():
    """教案意图识别"""
    cases = [
        "帮我写一份教案",
        "我要备课",
        "生成一份教案",
        "写一个分数的教案",
        "帮我生成教案看看",
    ]
    for msg in cases:
        result = _detect_intent(msg)
        assert result == "lesson_plan", f"消息 '{msg}' 应识别为 lesson_plan，实际 {result}"

def test_exam_intent():
    """出题意图识别"""
    cases = [
        "出10道计算题",
        "帮我组卷",
        "生成一份试卷",
        "出几道题目",
        "来一份考试题",
        "数学练习题",
    ]
    for msg in cases:
        result = _detect_intent(msg)
        assert result == "exam", f"消息 '{msg}' 应识别为 exam，实际 {result}"

def test_analytics_intent():
    """学情意图识别"""
    cases = [
        "看看班级情况",
        "学情分析",
        "我们班成绩怎么样",
        "查看数据分析",
        "班级学习情况如何",
    ]
    for msg in cases:
        result = _detect_intent(msg)
        assert result == "analytics", f"消息 '{msg}' 应识别为 analytics，实际 {result}"

def test_grading_intent():
    """批阅意图识别"""
    cases = [
        "帮我批改作业",
        "批阅一下",
        "看看学生作文",
        "家长签字情况",
        "今天的作业批一下",
    ]
    for msg in cases:
        result = _detect_intent(msg)
        assert result == "grading", f"消息 '{msg}' 应识别为 grading，实际 {result}"

def test_general_intent():
    """通用意图（无匹配）"""
    cases = [
        "你好",
        "今天天气怎么样",
        "你叫什么名字",
        "帮我想个办法",
    ]
    for msg in cases:
        result = _detect_intent(msg)
        assert result == "general", f"消息 '{msg}' 应识别为 general，实际 {result}"

def test_priority():
    """多关键词匹配时的优先级"""
    # "教案" 出现在 "出题" 之前，应优先匹配教案
    result = _detect_intent("帮我备课写教案还要出题")
    assert result == "lesson_plan", "应优先匹配教案"
