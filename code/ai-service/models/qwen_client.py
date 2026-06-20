"""通义千问 API 客户端封装
使用 DashScope SDK，支持 qwen-plus / qwen-vl-plus / qwen-turbo 等模型
"""
import os
import logging
from typing import Optional, Generator

logger = logging.getLogger("zhiwei-ai.qwen_client")

# DashScope SDK（生产环境安装：pip install dashscope）
try:
    import dashscope
    DASHSCOPE_AVAILABLE = True
except ImportError:
    DASHSCOPE_AVAILABLE = False
    logger.warning("dashscope 未安装，使用模拟模式")


class QwenClient:
    """通义千问客户端"""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ.get("DASHSCOPE_API_KEY", "")
        self.default_model = "qwen-plus"
        self.vl_model = "qwen-vl-plus"
        self.light_model = "qwen-turbo"
        
        if DASHSCOPE_AVAILABLE and self.api_key:
            dashscope.api_key = self.api_key
            logger.info(f"通义千问客户端初始化: 模型={self.default_model}")
            self.ready = True
        else:
            logger.warning("通义千问未配置 API Key，使用模拟模式")
            self.ready = False

    def chat(self, messages: list, model: Optional[str] = None, temperature: float = 0.7) -> str:
        """同步对话"""
        model = model or self.default_model
        
        if not self.ready:
            return self._mock_response(messages)

        try:
            response = dashscope.Generation.call(
                model=model,
                messages=messages,
                temperature=temperature,
                result_format='message'
            )
            if response.status_code == 200:
                return response.output.choices[0].message.content
            else:
                logger.error(f"通义千问 API 错误: {response.message}")
                return f"[API错误] {response.message}"
        except Exception as e:
            logger.error(f"通义千问调用失败: {e}")
            return f"[调用失败] {e}"

    def chat_stream(self, messages: list, model: Optional[str] = None, temperature: float = 0.7) -> Generator[str, None, None]:
        """流式对话（SSE用）"""
        model = model or self.default_model
        
        if not self.ready:
            yield "AI 服务未配置 API Key，请联系管理员。"
            return

        try:
            responses = dashscope.Generation.call(
                model=model,
                messages=messages,
                temperature=temperature,
                stream=True,
                result_format='message'
            )
            for response in responses:
                if response.status_code == 200:
                    yield response.output.choices[0].message.content
                else:
                    yield f"[错误: {response.message}]"
                    break
        except Exception as e:
            logger.error(f"流式调用失败: {e}")
            yield f"[流式调用失败: {e}]"

    def analyze_image(self, image_url: str, prompt: str, model: Optional[str] = None) -> str:
        """多模态图像分析（用于作文批阅）"""
        model = model or self.vl_model
        
        if not self.ready:
            return self._mock_image_response(prompt)

        messages = [{
            "role": "user",
            "content": [
                {"image": image_url},
                {"text": prompt}
            ]
        }]
        try:
            response = dashscope.MultiModalConversation.call(model=model, messages=messages)
            if response.status_code == 200:
                return response.output.choices[0].message.content[0]["text"]
            else:
                return f"[多模态API错误: {response.message}]"
        except Exception as e:
            logger.error(f"多模态调用失败: {e}")
            return f"[调用失败: {e}]"

    def _mock_response(self, messages: list) -> str:
        """开发环境模拟响应"""
        last_msg = messages[-1].get("content", "") if messages else ""
        return f"[开发模式] 通义千问回复: 收到您的消息「{last_msg[:50]}...」，API Key 未配置，请设置 DASHSCOPE_API_KEY。"

    def _mock_image_response(self, prompt: str) -> str:
        """开发环境模拟图像分析"""
        return json.dumps({
            "handwriting_neatness": 0.85,
            "correction_count": 2,
            "content_summary": "这是一篇关于春天的记叙文...",
            "struct_scores": {"content": 22, "structure": 18, "language": 20, "handwriting": 15}
        }, ensure_ascii=False)


# 全局实例
qwen_client = QwenClient()
