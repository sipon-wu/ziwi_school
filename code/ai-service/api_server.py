from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os

app = FastAPI(
    title="知微 AI 服务",
    description="AI Agent 服务（小微/知了/批阅）",
    version="1.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    """健康检查"""
    return {"status": "ok", "service": "ai-service", "version": "1.0.0"}


@app.get("/api/ai/health")
async def api_health():
    """API 健康检查"""
    return {"status": "ok", "service": "ai-service", "version": "1.0.0"}


@app.post("/api/ai/lesson-plan/generate")
async def generate_lesson_plan():
    """教案生成（占位，阿全后续实现）"""
    return {"message": "not_implemented", "status": "pending"}


@app.post("/api/ai/exercise/generate")
async def generate_exercise():
    """出题生成（占位）"""
    return {"message": "not_implemented", "status": "pending"}


@app.post("/api/ai/grading/submit")
async def grading_submit():
    """批阅提交（占位）"""
    return {"message": "not_implemented", "status": "pending"}


@app.post("/api/ai/xiaowei/chat")
async def xiaowei_chat():
    """小微对话（占位）"""
    return {"message": "not_implemented", "status": "pending"}


if __name__ == "__main__":
    port = int(os.getenv("AI_PORT", "8000"))
    uvicorn.run("api_server:app", host="0.0.0.0", port=port, reload=True)
