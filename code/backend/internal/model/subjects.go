package model

// ── 学科事实源（全系统唯一，前后端同源） ──
// 与前端 code/shared/subjects.ts、AI 服务 ai-service/subjects.py 必须保持一致。
// 以"知识边界"为准：仅考试计分文化课，不含艺体（音乐/美术/体育）与信息科技。
// 教材库原始学科名（生物学/道德与法治/思想政治/科学…）经 NormalizeSubject 归一到标准名。

// StandardSubjects 标准学科（中文），顺序即展示/筛选顺序
var StandardSubjects = []string{
	"语文", "数学", "英语",
	"物理", "化学", "生物",
	"历史", "地理", "政治",
}

// rawToStandard 教材库/外部原始学科名 → 标准学科名。
// 值为空串表示不属于知识边界（如信息技术/信息科技），写入时应剔除。
var rawToStandard = map[string]string{
	"语文":               "语文",
	"数学":               "数学",
	"英语":               "英语",
	"物理":               "物理",
	"化学":               "化学",
	"生物":               "生物",
	"历史":               "历史",
	"地理":               "地理",
	"政治":               "政治",
	"生物学":             "生物",
	"科学":               "科学", // 小学合科，按年级在下游拆物理/化学/生物/地
	"道德与法治":          "政治",
	"思想政治":            "政治",
	"中国历史":            "历史",
	"世界历史":            "历史",
	"地理图册":            "地理",
	"语文·书法练习指导":     "语文",
	"英语（三年级起点）":     "英语",
	"信息技术":            "",
	"信息科技":            "",
}

// IsStandardSubject 判断是否为标准学科名
func IsStandardSubject(s string) bool {
	for _, v := range StandardSubjects {
		if v == s {
			return true
		}
	}
	return false
}

// NormalizeSubject 将任意原始学科名归一到标准学科名。
// 返回空串表示非法/非知识边界学科（应拒写）。
func NormalizeSubject(raw string) string {
	if raw == "" {
		return ""
	}
	if v, ok := rawToStandard[raw]; ok {
		return v // 含空串（边界外）
	}
	return "" // 未登记的一律视为非法
}
