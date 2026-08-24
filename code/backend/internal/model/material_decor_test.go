package model

import "testing"

func TestDecorFacets_Matches(t *testing.T) {
	leaf := DecorFacets{
		"motif.自然.植物.树叶",
		"applicable.h5",
		"interaction.动效.浮动",
	}
	// applicable 命中
	if !leaf.Matches("h5", "") {
		t.Errorf("期望 h5 命中")
	}
	// applicable 不命中
	if leaf.Matches("ppt", "") {
		t.Errorf("期望 ppt 不命中")
	}
	// motif_root 命中（一级）
	if !leaf.Matches("", "自然") {
		t.Errorf("期望 motif 自然 命中")
	}
	// motif_root 不命中
	if leaf.Matches("", "人文") {
		t.Errorf("期望 motif 人文 不命中")
	}
	// 同时满足
	if !leaf.Matches("h5", "自然") {
		t.Errorf("期望 h5+自然 同时命中")
	}
	if leaf.Matches("ppt", "自然") {
		t.Errorf("期望 ppt+自然 不命中（applicable 错）")
	}

	// 空 facet 视为全匹配（无约束）
	empty := DecorFacets{}
	if !empty.Matches("ppt", "人文") {
		t.Errorf("空 facet 应视为全匹配")
	}
}
