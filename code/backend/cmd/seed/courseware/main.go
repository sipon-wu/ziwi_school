package main

// 课件种子生成命令（清库后一键重建演示课件，符合「提纲(content)+模板引用(theme_id)」新路由）
// 运行：go run ./cmd/seed/courseware （需 DATABASE_URL 或 DB_* 环境变量，与后端一致）
// 说明：
//   - 不依赖 LLM，提纲用预置示范文本（确定性、可复现），markdown 格式与前端 outlineToMarkdown 一致，
//     前端 markdownToOutline 可完美还原。
//   - 仅生成课件实例（type='courseware'），不动装饰素材库(decor_element) / 模板表(courseware_templates) / 习题教案。
//   - 幂等：同名课件已存在则跳过。

import (
	"fmt"
	"log"
	"os"
	"strings"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"github.com/zhiwei/backend/internal/model"
)

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func must(err error, msg string) {
	if err != nil {
		log.Fatalf("%s: %v", msg, err)
	}
}

// ── 提纲套路（中文演示文本，与前端 SCENARIO_OUTLINES 同源，搬为 Go 静态数据）──
type slide struct {
	title   string
	bullets []string
}

var outlines = map[string][]slide{
	"china-chinese": {
		{title: "封面", bullets: []string{"《课题名称》", "年级 · 语文", "授课教师：XXX"}},
		{title: "学习目标", bullets: []string{"积累字词，疏通文意", "把握文章主旨与情感", "体会语言与写法"}},
		{title: "情境导入", bullets: []string{"相关名句/画面引入", "激发阅读兴趣"}},
		{title: "初读感知", bullets: []string{"朗读正音，梳理脉络", "概括主要内容"}},
		{title: "研读赏析", bullets: []string{"品析关键词句", "体会修辞与情感", "小组交流"}},
		{title: "拓展积累", bullets: []string{"名句默写", "类文阅读"}},
		{title: "课堂小结", bullets: []string{"回顾要点", "布置作业"}},
	},
	"history-politics": {
		{title: "封面", bullets: []string{"《课题名称》", "年级 · 历史", "授课教师：XXX"}},
		{title: "学习目标", bullets: []string{"了解基本史实", "理解因果与影响", "形成价值认识"}},
		{title: "时代背景", bullets: []string{"社会环境与条件", "前因铺垫"}},
		{title: "事件脉络", bullets: []string{"起因 → 经过 → 结果", "关键人物与节点"}},
		{title: "分析探究", bullets: []string{"原因深度剖析", "历史/现实意义"}},
		{title: "价值启示", bullets: []string{"经验与教训", "当代关照"}},
		{title: "课堂小结", bullets: []string{"知识脉络梳理", "核心素养提升"}},
	},
	"math-physics": {
		{title: "封面", bullets: []string{"《课题名称》", "年级 · 学科", "授课教师：XXX"}},
		{title: "学习目标", bullets: []string{"知识与技能：理解概念与规律", "过程与方法：经历探究与推导", "素养：建模与推理能力"}},
		{title: "情境导入", bullets: []string{"生活中的现象 / 问题情境", "引出本节核心问题"}},
		{title: "概念建构", bullets: []string{"核心概念与定义", "关键要素与条件"}},
		{title: "公式与推导", bullets: []string{"核心公式呈现", "推导过程与思路", "适用条件与单位"}},
		{title: "例题精讲", bullets: []string{"典型例题呈现", "审题 → 建模 → 求解", "易错点提示"}},
		{title: "课堂小结", bullets: []string{"知识结构化梳理", "方法归纳"}},
	},
	"science-bio": {
		{title: "封面", bullets: []string{"《课题名称》", "年级 · 学科", "授课教师：XXX"}},
		{title: "学习目标", bullets: []string{"观察与描述现象", "理解原理与机制", "形成科学探究意识"}},
		{title: "现象观察", bullets: []string{"呈现观察 / 实验现象", "提出待解决问题"}},
		{title: "提出假设", bullets: []string{"基于现象作出猜想", "明确探究变量"}},
		{title: "实验探究", bullets: []string{"方案设计与步骤", "操作要点与安全", "记录数据"}},
		{title: "分析结论", bullets: []string{"处理数据 / 现象", "得出结论并验证假设"}},
		{title: "课堂小结", bullets: []string{"核心概念回顾", "探究方法提炼"}},
	},
	"english": {
		{title: "Cover", bullets: []string{"Unit / Lesson Title", "Grade · English", "Teacher: XXX"}},
		{title: "Learning Goals", bullets: []string{"能听懂并说出目标语", "能读懂并运用结构", "乐于表达、跨文化意识"}},
		{title: "Warm-up", bullets: []string{"歌曲 / 游戏 / 视频导入", "激活已知、铺垫话题"}},
		{title: "Words & Expressions", bullets: []string{"目标词汇与短语", "发音与拼写操练"}},
		{title: "Reading / Listening", bullets: []string{"语篇呈现与理解", "获取关键信息"}},
		{title: "Grammar Focus", bullets: []string{"目标句型 / 语法点", "归纳与例句"}},
		{title: "Summary & Homework", bullets: []string{"本课小结", "听说读写作业"}},
	},
	"art-pe": {
		{title: "封面", bullets: []string{"《课题名称》", "年级 · 学科", "授课教师：XXX"}},
		{title: "学习目标", bullets: []string{"感知与欣赏", "掌握技法 / 动作要领", "乐于表现与创造"}},
		{title: "欣赏感知", bullets: []string{"名作 / 示范欣赏", "感受形式与情感"}},
		{title: "技法解析", bullets: []string{"关键要领与步骤", "易错提醒"}},
		{title: "实践创作", bullets: []string{"动手创作 / 动作练习", "巡回指导"}},
		{title: "展示评价", bullets: []string{"作品 / 成果展示", "自评互评"}},
		{title: "课堂小结", bullets: []string{"收获与体会", "审美/健康提升"}},
	},
	"class-meeting": {
		{title: "封面", bullets: []string{"主题班会：《主题》", "班级 · 日期", "主持人：XXX"}},
		{title: "班会目标", bullets: []string{"明确主题意义", "达成共识与行动"}},
		{title: "情境故事", bullets: []string{"案例 / 视频 / 身边事", "引发共鸣与思考"}},
		{title: "讨论交流", bullets: []string{"分组讨论议题", "分享观点"}},
		{title: "行动倡议", bullets: []string{"拟定班级公约", "制定行动计划"}},
		{title: "总结感悟", bullets: []string{"班主任寄语", "我的收获"}},
	},
	"lecture-open": {
		{title: "封面", bullets: []string{"《课题名称》", "说课 / 公开课", "授课教师：XXX"}},
		{title: "教材与学情", bullets: []string{"教材地位与作用", "学情分析"}},
		{title: "教学目标", bullets: []string{"知识与能力", "过程与方法", "重难点突破"}},
		{title: "教法学法", bullets: []string{"教法选择", "学法指导"}},
		{title: "教学过程", bullets: []string{"环节设计与意图", "师生活动安排"}},
		{title: "板书设计", bullets: []string{"结构化板书", "逻辑呈现"}},
		{title: "教学反思", bullets: []string{"亮点与不足", "改进方向"}},
	},
	"cartoon-kindergarten": {
		{title: "封面", bullets: []string{"《课题名称》", "幼儿园 · 游戏活动", "教师：XXX"}},
		{title: "活动目标", bullets: []string{"在游戏中感知", "乐意表达与交往", "体验快乐"}},
		{title: "情境导入", bullets: []string{"动画 / 儿歌 / 故事引入", "吸引注意"}},
		{title: "趣味认知", bullets: []string{"认识事物与名称", "观察与模仿"}},
		{title: "游戏互动", bullets: []string{"动手操作 / 角色扮演", "同伴合作"}},
		{title: "分享展示", bullets: []string{"说一说 / 秀一秀", "鼓励欣赏"}},
		{title: "活动延伸", bullets: []string{"家庭小任务", "区域游戏"}},
	},
}

// 风格 → 代表 themeId（对齐前端 pptThemes.THEME_BY_STYLE）
var themeByStyle = map[string]string{
	"china":    "zgf-ink-wash",
	"tech":     "te-quantum-blue",
	"fresh":    "fr-mint",
	"academic": "aca-edu-blue",
	"cartoon":  "sp-cartoon",
	"minimal":  "min-classic-blue",
}

type seedCw struct {
	name    string
	subject string
	grade   string
	style   string
	outline string
	format  string
}

// 12 套代表课件：覆盖 9 套路 + 多风格（含 1 套 H5 演示）
var coursewares = []seedCw{
	{"《观潮》PPT课件", "语文", "四年级", "china", "china-chinese", "ppt"},
	{"《秦朝统一》PPT课件", "历史", "七年级", "china", "history-politics", "ppt"},
	{"《函数》PPT课件", "数学", "高一", "tech", "math-physics", "ppt"},
	{"《牛顿运动定律》PPT课件", "物理", "高一", "tech", "math-physics", "ppt"},
	{"《细胞的结构》PPT课件", "生物", "初一", "tech", "science-bio", "ppt"},
	{"《My School》PPT课件", "英语", "三年级", "fresh", "english", "ppt"},
	{"《溶液》PPT课件", "化学", "高一", "academic", "math-physics", "ppt"},
	{"《快乐涂色》PPT课件", "美术", "幼儿园", "cartoon", "art-pe", "ppt"},
	{"《防溺水》主题班会PPT", "政治", "小学", "cartoon", "class-meeting", "ppt"},
	{"《背影》说课PPT", "语文", "初二", "minimal", "lecture-open", "ppt"},
	{"《趣味识字》幼儿园PPT", "语文", "幼儿园", "cartoon", "cartoon-kindergarten", "ppt"},
	{"《天气》H5互动课件", "科学", "二年级", "fresh", "science-bio", "h5"},
}

func buildContent(name, subject, grade string, slides []slide) string {
	var b strings.Builder
	b.WriteString("# " + name + "\n\n")
	b.WriteString("> " + subject + " · " + grade + "\n\n")
	for _, s := range slides {
		b.WriteString("## " + s.title + "\n")
		for _, bl := range s.bullets {
			b.WriteString("- " + bl + "\n")
		}
		b.WriteString("\n")
	}
	return strings.TrimSpace(b.String())
}

func main() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		host := getEnv("DB_HOST", "postgres")
		port := getEnv("DB_PORT", "5432")
		user := getEnv("DB_USER", "zhiwei")
		pass := getEnv("DB_PASSWORD", "zhiwei2026")
		dbname := getEnv("DB_NAME", "zhiwei")
		dsn = "postgresql://" + user + ":" + pass + "@" + host + ":" + port + "/" + dbname + "?sslmode=disable"
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	must(err, "connect db")

	created, skipped := 0, 0
	for _, c := range coursewares {
		var existing model.Material
		if err := db.Where("name = ? AND type = 'courseware'", c.name).First(&existing).Error; err == nil {
			skipped++
			continue
		}
		slides, ok := outlines[c.outline]
		if !ok {
			log.Printf("跳过 %s：缺少提纲套路 %s", c.name, c.outline)
			skipped++
			continue
		}
		themeID := themeByStyle[c.style]
		m := model.Material{
			Name:      c.name,
			Type:      "courseware",
			Format:    c.format,
			Tag:       c.subject + c.grade,
			Content:   buildContent(c.name, c.subject, c.grade, slides),
			Status:    "active",
			Grade:     c.grade,
			Subject:   c.subject,
			ThemeID:   themeID,
			Category:  "courseware",
		}
		must(db.Create(&m).Error, "create courseware "+c.name)
		created++
		fmt.Printf("已生成：%-28s 学科=%-4s 风格=%-8s theme_id=%s\n", c.name, c.subject, c.style, themeID)
	}
	fmt.Printf("\n课件种子完成：新建 %d 套，跳过(已存在) %d 套\n", created, skipped)
}
