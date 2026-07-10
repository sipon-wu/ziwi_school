"""DashScope text-embedding-v3 封装（默认 1024 维，中文教学场景质量好、成本低）。

供两处使用：
  1. 入库脚本 scripts/ingest_lesson_source.py —— 批量给备课包/教材 chunks 生成向量
  2. /api/ai/rag/search 端点 —— 给用户输入的查询生成向量后做余弦检索
"""
import os
import time

import dashscope
from dashscope import TextEmbedding

# 维度一旦定下，重嵌 4.7 万条需重烧 API 成本，故集中在此配置
EMBED_MODEL = os.getenv("DASHSCOPE_EMBED_MODEL", "text-embedding-v3")
EMBED_DIM = int(os.getenv("EMBED_DIM", "1024"))

dashscope.api_key = os.getenv("DASHSCOPE_API_KEY")


def embed_texts(texts, batch_size=16, max_retries=6):
    """批量获取 embedding，返回 list[list[float]]，与输入顺序严格一致。

    batch_size 控制单次 API 调用携带的条数；DashScope 有 QPS/TPM 限制，
    超限时按指数退避重试，避免批量任务中途失败。
    """
    if not texts:
        return []
    out = []
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        out.extend(_embed_batch_with_retry(batch, max_retries))
    return out


def embed_one(text):
    return embed_texts([text])[0]


def _embed_batch_with_retry(batch, max_retries):
    delay = 1.0
    last_err = None
    for _ in range(max_retries):
        try:
            resp = TextEmbedding.call(model=EMBED_MODEL, input=batch)
            if getattr(resp, "status_code", None) != 200:
                raise RuntimeError(
                    f"embed http={getattr(resp, 'status_code', '?')}: "
                    f"{getattr(resp, 'message', 'unknown error')}"
                )
            embs = [e["embedding"] for e in resp.output["embeddings"]]
            if len(embs) != len(batch):
                raise RuntimeError(f"embed count mismatch {len(embs)} != {len(batch)}")
            return embs
        except Exception as e:  # noqa: BLE001
            last_err = e
            time.sleep(delay)
            delay = min(delay * 2, 30)
    raise RuntimeError(f"embed failed after {max_retries} retries: {last_err}")
