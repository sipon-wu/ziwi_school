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


def embed_texts(texts, batch_size=10, max_retries=6, throttle=0.1):
    """批量获取 embedding，返回 list[list[float]]，与输入顺序严格一致。

    batch_size=10：text-embedding-v3 单次 API 调用最多携带 10 条，超过会 400。
    throttle=0.1：每批之间的节流 sleep（秒），对应 ~10 QPS / 600 次·分，
    给百炼工作空间 1200 次·分限额留 2× 余量，避免临界 429 风暴；
    全量入库 5 万条仅靠失败退避仍会抖动，显式节流更稳。
    超限时按指数退避重试，避免批量任务中途失败。
    """
    if not texts:
        return []
    out = []
    n = len(texts)
    for i in range(0, n, batch_size):
        batch = texts[i : i + batch_size]
        out.extend(_embed_batch_with_retry(batch, max_retries))
        # 末批后无需 sleep
        if throttle and i + batch_size < n:
            time.sleep(throttle)
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
