"""课标RAG检索模块 v2
向量检索：bge-small-zh-v1.5 嵌入 → pgvector HNSW 相似度搜索
"""
import os, json, logging
from typing import List, Dict, Optional
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    HAS_PG = True
except ImportError:
    psycopg2 = None
    RealDictCursor = None
    HAS_PG = False

logger = logging.getLogger("zhiwei-ai.rag")

DB_URL = os.environ.get("DATABASE_URL", "postgresql://zhiwei:zhiwei2026@localhost:5432/zhiwei")

# 嵌入模型（与 import_curriculum.py 保持一致）
try:
    from sentence_transformers import SentenceTransformer
    MODEL_NAME = "BAAI/bge-small-zh-v1.5"
    _embed_model = SentenceTransformer(MODEL_NAME)
    HAS_EMBEDDING = True
    logger.info(f"RAG 嵌入模型就绪: {MODEL_NAME}")
except ImportError:
    _embed_model = None
    HAS_EMBEDDING = False
    logger.warning("sentence-transformers 未安装，RAG 使用关键词匹配降级")


class CurriculumRAG:
    """课标 RAG 检索器"""

    def __init__(self):
        self.db_url = DB_URL

    def _get_conn(self):
        if not HAS_PG:
            return None
        return psycopg2.connect(self.db_url)

    def _embed_query(self, text: str) -> list:
        if HAS_EMBEDDING and _embed_model:
            return _embed_model.encode(text, normalize_embeddings=True).tolist()
        return None  # 降级到关键词匹配

    def search(self, subject: str, grade: str, lesson_title: str, top_k: int = 5) -> List[Dict]:
        """向量语义检索相关课标条目"""
        stage = self._grade_to_stage(grade)
        embedding = self._embed_query(f"{subject} {grade} {lesson_title}")

        if embedding is None:
            # 降级：关键词匹配
            return self._keyword_fallback(subject, stage, lesson_title, top_k)

        conn = self._get_conn()
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            # 使用 pgvector 余弦相似度
            cur.execute("""
                SELECT id, subject, stage, domain, code, content, competency_dimension,
                       1 - (embedding <=> %s::vector) AS similarity
                FROM curriculum_standards
                WHERE subject = %s AND stage = %s
                ORDER BY embedding <=> %s::vector
                LIMIT %s
            """, (embedding, subject, stage, embedding, top_k))

            results = []
            for row in cur.fetchall():
                results.append({
                    "id": row["id"],
                    "subject": row["subject"],
                    "stage": row["stage"],
                    "domain": row["domain"],
                    "code": row["code"],
                    "content": row["content"],
                    "competency_dimension": row["competency_dimension"],
                    "relevance": round(float(row["similarity"]), 3)
                })
            cur.close()
            logger.info(f"RAG 检索: subject={subject} stage={stage} top_k={top_k} → {len(results)} 条匹配")
            return results
        except Exception as e:
            logger.warning(f"RAG 向量检索异常: {e}")
            return self._keyword_fallback(subject, stage, lesson_title, top_k)
        finally:
            if conn:
                conn.close()

    def validate_alignment(self, lesson_content: str, subject: str, grade: str) -> List[Dict]:
        """校验教案与课标的对齐情况"""
        standards = self.search(subject, grade, lesson_content, top_k=10)
        findings = []
        for std in standards:
            keywords = std.get("content", "").split("。")[:2]
            mention = any(kw[:6] in lesson_content for kw in keywords if len(kw) >= 6)
            findings.append({
                "code": std["code"],
                "domain": std["domain"],
                "content": std["content"][:60],
                "aligned": mention,
                "confidence": 0.85 if mention else 0.4
            })
        return findings

    def _grade_to_stage(self, grade: str) -> str:
        grade_map = {"一年级":1,"二年级":2,"三年级":3,"四年级":4,"五年级":5,"六年级":6,"七年级":7,"八年级":8,"九年级":9}
        num = grade_map.get(grade, 3)
        if num <= 2: return "1-2年级"
        elif num <= 4: return "3-4年级"
        elif num <= 6: return "5-6年级"
        else: return "7-9年级"

    def _keyword_fallback(self, subject: str, stage: str, query: str, top_k: int) -> List[Dict]:
        if not HAS_PG:
            return self._sample_standards(subject, stage)[:top_k]
        try:
            conn = self._get_conn()
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute("""
                SELECT id, subject, stage, domain, code, content, competency_dimension
                FROM curriculum_standards
                WHERE subject = %s AND stage = %s
                LIMIT %s
            """, (subject, stage, top_k))
            results = []
            for row in cur.fetchall():
                results.append({
                    "id": row["id"], "subject": row["subject"], "stage": row["stage"],
                    "domain": row["domain"], "code": row["code"], "content": row["content"],
                    "competency_dimension": row["competency_dimension"], "relevance": 0.5
                })
            cur.close()
            return results
        except Exception as e:
            logger.warning(f"RAG 数据库异常: {e}")
            return self._sample_standards(subject, stage)[:top_k]
        finally:
            if conn:
                conn.close()


    def _sample_standards(self, subject: str, stage: str) -> List[Dict]:
        """数据库不可用时的示例课标（测试用）"""
        samples = {
            "语文": ["能初步把握文章的主要内容", "能复述叙事性作品的大意", "能用普通话正确流利地朗读课文"],
            "数学": ["能进行简单的分数加减运算", "理解分数的意义", "会计算长方形正方形的面积"],
            "英语": ["能认读所学词语", "能在图片帮助下读懂简单故事", "能模仿范例写句子"],
        }
        content_list = samples.get(subject, ["课程标准条目"])
        return [{"id":f"{subject}-{i}","subject":subject,"stage":stage,"domain":"示例","code":f"X.{i+1}","content":c,"competency_dimension":"语言运用","relevance":0.8} for i,c in enumerate(content_list)]

# 全局实例
curriculum_rag = CurriculumRAG()
