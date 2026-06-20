"""导入课标数据到 pgvector
使用方法: python scripts/import_curriculum.py
"""
import os, json, sys, logging
import psycopg2
from psycopg2.extras import execute_values

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
log = logging.getLogger(__name__)

DB_URL = os.environ.get("DATABASE_URL", "postgresql://zhiwei:zhiwei2026@localhost:5432/zhiwei")

DATA_FILE = os.path.join(os.path.dirname(__file__), "../../curriculum-data/curriculum_standards.json")

# MVP阶段：如果没有安装 sentence-transformers，使用零向量占位
# 生产环境: pip install sentence-transformers 后自动启用真嵌入
try:
    from sentence_transformers import SentenceTransformer
    MODEL_NAME = "BAAI/bge-small-zh-v1.5"  # 小模型，512维，内存友好
    model = SentenceTransformer(MODEL_NAME)
    log.info(f"嵌入模型加载成功: {MODEL_NAME}, 维度={model.get_sentence_embedding_dimension()}")
    HAS_EMBEDDING = True
except ImportError:
    log.warning("sentence-transformers 未安装，使用零向量占位。生产环境请: pip install sentence-transformers")
    HAS_EMBEDDING = False
    model = None


def load_standards(path: str) -> list:
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def embed_text(text: str) -> list:
    if HAS_EMBEDDING and model:
        return model.encode(text, normalize_embeddings=True).tolist()
    return [0.0] * 512  # 零向量占位

def import_to_db(conn, standards: list):
    cur = conn.cursor()

    # 确保 pgvector 扩展启用
    cur.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # 创建课标向量表（如果不存在）
    cur.execute("""
        CREATE TABLE IF NOT EXISTS curriculum_standards (
            id VARCHAR(50) PRIMARY KEY,
            subject VARCHAR(20) NOT NULL,
            stage VARCHAR(20) NOT NULL,
            domain VARCHAR(100) NOT NULL,
            code VARCHAR(20) NOT NULL,
            content TEXT NOT NULL,
            competency_dimension VARCHAR(100),
            quality_standard TEXT,
            embedding vector(512),
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_curriculum_subject ON curriculum_standards(subject, stage);
    """)

    # 清空旧数据
    cur.execute("DELETE FROM curriculum_standards")
    log.info("已清空旧课标数据")

    # 批量导入
    rows = []
    for std in standards:
        embedding = embed_text(std["content"])
        rows.append((
            std["id"], std["subject"], std["stage"], std["domain"],
            std["code"], std["content"],
            std.get("competency_dimension", ""),
            std.get("quality_standard", ""),
            embedding
        ))

    execute_values(cur, """
        INSERT INTO curriculum_standards (id, subject, stage, domain, code, content, competency_dimension, quality_standard, embedding)
        VALUES %s
        ON CONFLICT (id) DO UPDATE SET
            content = EXCLUDED.content,
            embedding = EXCLUDED.embedding,
            competency_dimension = EXCLUDED.competency_dimension
    """, rows, template="(%s, %s, %s, %s, %s, %s, %s, %s, %s::vector)")

    conn.commit()
    log.info(f"成功导入 {len(rows)} 条课标记录")

    # 创建 HNSW 索引
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_curriculum_embedding
        ON curriculum_standards
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 200);
    """)
    conn.commit()
    log.info("HNSW 索引已创建")

    # 验证
    cur.execute("SELECT COUNT(*) FROM curriculum_standards")
    count = cur.fetchone()[0]
    log.info(f"验证: 课标表共 {count} 条记录")

    cur.execute("SELECT subject, COUNT(*) FROM curriculum_standards GROUP BY subject ORDER BY subject")
    for row in cur.fetchall():
        log.info(f"  {row[0]}: {row[1]} 条")

    cur.close()

def main():
    conn = psycopg2.connect(DB_URL)
    try:
        log.info(f"加载课标文件: {DATA_FILE}")
        standards = load_standards(DATA_FILE)
        log.info(f"共 {len(standards)} 条课标条目")
        import_to_db(conn, standards)
        log.info("✅ 课标导入完成")
    finally:
        conn.close()

if __name__ == "__main__":
    main()
