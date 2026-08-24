package model

import "time"

// FacetVocab facet 受控词表（运营维护的母题/媒介等词库）。
// type 区分维度: motif(母题) | medium(媒介) | category(分类) ...
// value 为存储值(如 "自然")，label 为展示名，parent 支持二级(如 自然.植物)。
type FacetVocab struct {
	ID     string    `json:"id" gorm:"primaryKey;type:varchar(50)"`
	Type   string    `json:"type" gorm:"type:varchar(30);index:idx_facet_type"`
	Value  string    `json:"value" gorm:"type:varchar(80)"`
	Label  string    `json:"label" gorm:"type:varchar(120)"`
	Parent string    `json:"parent" gorm:"type:varchar(50);default:''"`
	Sort   int       `json:"sort"`
	CreatedAt time.Time `json:"created_at"`
}

func (FacetVocab) TableName() string { return "facet_vocab" }
