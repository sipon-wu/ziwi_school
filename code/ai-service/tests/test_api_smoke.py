"""AI 服务 API 冒烟测试（Mock 模式）"""
import pytest
from fastapi.testclient import TestClient
import sys
sys.path.insert(0, '.')

from api_server import app

client = TestClient(app)

def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["service"] == "ai-service"

def test_ping():
    resp = client.get("/ping")
    assert resp.status_code == 200
    assert resp.json() == {"pong": True}

def test_lesson_plan_generate():
    """教案生成 — Mock 模式"""
    resp = client.post("/api/lesson-plan/generate", json={
        "subject": "语文",
        "grade": "四年级",
        "lesson_title": "《观潮》",
        "period": 1,
        "format_template": "core_literacy"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert len(data["content"]) > 100, f"教案内容过短: {len(data['content'])} 字符"
    assert "教学目标" in data["content"]
    assert "教学过程" in data["content"]
    assert len(data["curriculum_alignments"]) >= 2
    assert "model" in data
    assert data["generation_time_ms"] >= 0

def test_lesson_plan_missing_title():
    """缺课题名称 → 400"""
    resp = client.post("/api/lesson-plan/generate", json={
        "subject": "语文",
        "grade": "四年级",
        "lesson_title": "",
    })
    assert resp.status_code == 422  # Pydantic validation

def test_exam_generate():
    """出题 — Mock 模式"""
    resp = client.post("/api/exam/generate", json={
        "subject": "数学",
        "knowledge_point": "分数加减法",
        "grade": "四年级",
        "difficulty": "L2",
        "count": 10
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["total_questions"] == 10
    assert len(data["questions"]) == 10

def test_grading_auto():
    """批阅 — Mock 模式"""
    resp = client.post("/api/grading/auto", json={
        "answers": [
            {"id": "Q1", "expected": "A", "student_answer": "A", "type": "choice"},
            {"id": "Q2", "expected": "3/4", "student_answer": "3/4", "type": "fill"},
            {"id": "Q3", "expected": ">", "student_answer": "<", "type": "choice"},
        ],
        "assignment_id": "test-1",
        "student_id": "test-s1"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert len(data["results"]) == 3
    assert data["results"][0]["ai_score"] == 10  # 正确答案
    assert data["results"][2]["ai_score"] == 0   # 错误答案

def test_composition_grading():
    """作文批阅"""
    resp = client.post("/api/composition/grade", json={
        "image_url": "http://example.com/composition.jpg",
        "student_id": "test-s1"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "scores" in data
    assert data["scores"]["total"] == 75

def test_chat_intent():
    """小微对话 — 意图路由"""
    # 教案意图
    resp = client.post("/api/chat", json={"message": "帮我写一份教案"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["intent"] == "lesson_plan"
    assert len(data["suggestions"]) >= 2

    # 出题意图
    resp = client.post("/api/chat", json={"message": "出10道计算题"})
    data = resp.json()
    assert data
    assert data["intent"] == "exam"

    # 学情意图
    resp = client.post("/api/chat", json={"message": "看看班级学习情况"})
    data = resp.json()
    assert data
    assert data["intent"] == "analytics"
    assert "平均分" in data["reply"]

    # 批阅意图
    resp = client.post("/api/chat", json={"message": "批改今天提交的作业"})
    data = resp.json()
    assert data
    assert data["intent"] == "grading"

def test_chat_all_intents_return_suggestions():
    """所有意图都返回快捷指令"""
    for msg in ["写教案", "出题", "看学情", "批作业"]:
        resp = client.post("/api/chat", json={"message": msg})
        data = resp.json()
        assert len(data["suggestions"]) >= 2, f"消息 '{msg}' 快捷指令不足"
