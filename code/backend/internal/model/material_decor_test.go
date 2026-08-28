package model

import "testing"

func TestDecorFacets_Matches(t *testing.T) {
	leaf := DecorFacets{
		"motif.国风.水墨",
		"color.红金系",
		"page_type.cover",
		"applicable.ppt",
	}
	// applicable 命中
	if !leaf.Matches("ppt", "", "", "") {
		t.Errorf("期望 ppt 命中")
	}
	// applicable 不命中
	if leaf.Matches("h5", "", "", "") {
		t.Errorf("期望 h5 不命中")
	}
	// motif 命中（一级）
	if !leaf.Matches("", "国风", "", "") {
		t.Errorf("期望 motif 国风 命中")
	}
	// motif 不命中
	if leaf.Matches("", "科技", "", "") {
		t.Errorf("期望 motif 科技 不命中")
	}
	// color 命中
	if !leaf.Matches("", "", "红金系", "") {
		t.Errorf("期望 color 红金系 命中")
	}
	// page_type 命中
	if !leaf.Matches("", "", "", "cover") {
		t.Errorf("期望 page_type cover 命中")
	}
	// 多约束同时满足
	if !leaf.Matches("ppt", "国风", "红金系", "cover") {
		t.Errorf("期望 4 维同时命中")
	}
	if leaf.Matches("h5", "国风", "红金系", "cover") {
		t.Errorf("期望 applicable 错时整体不命中")
	}

	// 聚类标签多选 OR：color 传 "蓝系,红金系" 任一命中
	if !leaf.Matches("", "", "蓝系,红金系", "") {
		t.Errorf("期望色系多选 OR 命中")
	}

	// 空 facet 视为全匹配（无约束）
	empty := DecorFacets{}
	if !empty.Matches("ppt", "人文", "蓝系", "content") {
		t.Errorf("空 facet 应视为全匹配")
	}
}

func TestSplitFacet(t *testing.T) {
	d, v := splitFacet("motif.国风.水墨")
	if d != "motif" || v != "国风" {
		t.Errorf("splitFacet 期望 motif/国风, 得 %s/%s", d, v)
	}
	d, v = splitFacet("applicable.ppt")
	if d != "applicable" || v != "ppt" {
		t.Errorf("splitFacet 期望 applicable/ppt, 得 %s/%s", d, v)
	}
}
