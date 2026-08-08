package model

import "time"

// ─────────────────────────────────────────────────────────────
// 教材/讲义蒸馏底座（知微·有谱引擎 RAG 素材层）
//
// 设计要点（与 staging 实际 schema 对齐）：
//   - tb_lesson_source 是 32 分区的分区表（按 shard_key 取模），GORM AutoMigrate
//     不支持分区表/vector/HNSW，因此这两张表不走 AutoMigrate，而由 main.go
//     中的幂等原生 SQL 负责建表（父表 + 32 分区 + 向量索引 + 外键）。
//   - 本文件仅定义 struct 供代码内查询/扫描使用，gorm 表名已显式指定。
//   - SaaS 模式 storage_mode 恒为 'distilled_only'（原文不上服务器，见分水岭规则）。
// ─────────────────────────────────────────────────────────────

// LessonSource 蒸馏素材行（分区表子表同构）
type LessonSource struct {
	ID          int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	ChunkID     string    `gorm:"column:chunk_id" json:"chunk_id"`
	Stage       string    `gorm:"column:stage" json:"stage"`
	Subject     string    `gorm:"column:subject" json:"subject"`
	Grade       string    `gorm:"column:grade" json:"grade"`
	Volume      string    `gorm:"column:volume" json:"volume"`
	Version     string    `gorm:"column:version" json:"version"`
	NewOld      string    `gorm:"column:new_old" json:"new_old"`
	Unit        string    `gorm:"column:unit" json:"unit"`
	Chapter     string    `gorm:"column:chapter" json:"chapter"`
	SourceType  string    `gorm:"column:source_type" json:"source_type"`
	SourceID    string    `gorm:"column:source_id" json:"source_id"`
	Content     string    `gorm:"column:content" json:"content"`
	StdClauses  string    `gorm:"column:std_clauses" json:"std_clauses"`
	KgUnit      string    `gorm:"column:kg_unit" json:"kg_unit"`
	Copyright   string    `gorm:"column:copyright" json:"copyright"`
	ShardKey    string    `gorm:"column:shard_key;not null" json:"shard_key"`
	UnitSeq     int       `gorm:"column:unit_seq" json:"unit_seq"`
	Embedding   string    `gorm:"column:embedding;-:migration" json:"-"` // vector(1024)，扫描时用原生 SQL
	LectureID   string    `gorm:"column:lecture_id" json:"lecture_id"`
	StorageMode string    `gorm:"column:storage_mode" json:"storage_mode"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (LessonSource) TableName() string { return "tb_lesson_source" }

// LessonLecture 讲义蒸馏产物（AI 黑盒底座，教师不可见不可编辑）
type LessonLecture struct {
	ID                 string    `gorm:"primaryKey;column:id" json:"id"`
	LessonKey          string    `gorm:"column:lesson_key;not null" json:"lesson_key"`
	Subject            string    `gorm:"column:subject;not null" json:"subject"`
	Grade              string    `gorm:"column:grade;not null" json:"grade"`
	Unit               string    `gorm:"column:unit" json:"unit"`
	Chapter            string    `gorm:"column:chapter" json:"chapter"`
	Title              string    `gorm:"column:title;not null" json:"title"`
	Lecture            string    `gorm:"column:lecture;not null" json:"lecture"` // jsonb，扫描用原生 SQL
	SourceType         string    `gorm:"column:source_type;not null" json:"source_type"`
	SourceIDs          []string  `gorm:"column:source_ids" json:"source_ids"`
	TextbookVersionIDs []string  `gorm:"column:textbook_version_ids" json:"textbook_version_ids"`
	KnowledgeNodeIDs   []string  `gorm:"column:knowledge_node_ids" json:"knowledge_node_ids"`
	StandardClauseIDs  []string  `gorm:"column:standard_clause_ids" json:"standard_clause_ids"`
	OriginalTextStatus string    `gorm:"column:original_text_status" json:"original_text_status"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

func (LessonLecture) TableName() string { return "tb_lesson_lecture" }
