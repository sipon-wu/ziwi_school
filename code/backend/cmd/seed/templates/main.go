package main

// 课件模板外移 seed：把前端 cwTemplate.ts 的 PPT_TEMPLATE_DEFS / H5_TEMPLATE_DEFS
// 搬迁进 courseware_templates 表（后端成为模板真源）。
// 运行：go run ./cmd/seed/templates （环境变量 DATABASE_URL 同主服务）
// 幂等：基于 id Upsert，可重复运行。

import (
	"log"
	"os"
	"strconv"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"github.com/zhiwei/backend/internal/model"
	"github.com/zhiwei/backend/internal/repository"
)

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// ── 标签构造助手（与前端 cwTemplate.ts 的 styles/stages/subjects/scenarios/pageTypes 语义一致）──
func t(kind, value string) model.TplTag { return model.TplTag{Kind: kind, Value: value} }
func styles(v ...string) []model.TplTag {
	out := make([]model.TplTag, 0, len(v))
	for _, x := range v {
		out = append(out, t("style", x))
	}
	return out
}
func stages(v ...string) []model.TplTag {
	out := make([]model.TplTag, 0, len(v))
	for _, x := range v {
		out = append(out, t("stage", x))
	}
	return out
}
func subjects(v ...string) []model.TplTag {
	out := make([]model.TplTag, 0, len(v))
	for _, x := range v {
		out = append(out, t("subject", x))
	}
	return out
}
func scenarios(v ...string) []model.TplTag {
	out := make([]model.TplTag, 0, len(v))
	for _, x := range v {
		out = append(out, t("scenario", x))
	}
	return out
}
func pageTypes(v ...string) []model.TplTag {
	out := make([]model.TplTag, 0, len(v))
	for _, x := range v {
		out = append(out, t("pageType", x))
	}
	return out
}

// tplDef 与前端 TplDef 对齐（仅取外移所需字段）
type tplDef struct {
	style       string
	themeID     string
	colorFamily string
	tags        []model.TplTag
	subjects    []string
	grades      []string
}

func main() {
	dsn := getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/ziwi?sslmode=disable")
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("连接数据库失败: %v", err)
	}
	repo := repository.NewCoursewareTemplateRepository(db)

	// 合并 PPT + H5 定义
	defs := []struct {
		kind string
		defs []tplDef
	}{
		{"ppt", pptDefs()},
		{"h5", h5Defs()},
	}

	count := 0
	for _, grp := range defs {
		for i, d := range grp.defs {
			id := grp.kind + "-" + d.style + "-" + strconv.Itoa(i+1)
			name := d.style + "·" + d.themeID // 简化名；前端 getTheme 会解析真实主题名
			tmpl := &model.CoursewareTemplate{
				ID:          id,
				Kind:        grp.kind,
				Name:        name,
				Style:       d.style,
				ColorFamily: d.colorFamily,
				ThemeID:     d.themeID,
				Tags:        d.tags,
				Subjects:    model.StringSlice(d.subjects),
				Grades:      model.StringSlice(d.grades),
				IsBuiltin:   true,
				CreatedAt:   time.Now(),
				UpdatedAt:   time.Now(),
			}
			if err := repo.Upsert(nil, tmpl); err != nil {
				log.Fatalf("upsert %s 失败: %v", id, err)
			}
			count++
		}
	}
	log.Printf("模板 seed 完成，共写入 %d 套（PPT+H5）", count)
}

// ── PPT 模板定义（对齐前端 PPT_TEMPLATE_DEFS，749-842 行）──
func pptDefs() []tplDef {
	return []tplDef{
		{style: "china", themeID: "zgf-ink-wash", colorFamily: "mono", tags: append(styles("china"), append(scenarios("general"), stages("primary", "junior", "senior")...)...)},
		{style: "china", themeID: "zgf-guochao", colorFamily: "red-gold", tags: append(styles("china"), append(scenarios("class-meeting", "first-class"), stages("primary", "junior")...)...)},
		{style: "china", themeID: "zgf-shanshui", colorFamily: "cyan-green", tags: append(styles("china"), append(scenarios("general"), stages("junior", "senior")...)...)},
		{style: "china", themeID: "zgf-song-qing", colorFamily: "cyan-green", tags: append(styles("china"), append(subjects("chinese", "history"), stages("junior", "senior")...)...), subjects: sub("chinese", "history")},
		{style: "minimal", themeID: "min-classic-blue", colorFamily: "blue", tags: append(styles("minimal"), append(scenarios("lecture", "open-class"), stages("junior", "senior")...)...)},
		{style: "minimal", themeID: "min-geo", colorFamily: "gray", tags: append(styles("minimal"), append(scenarios("general"), stages("senior", "college")...)...)},
		{style: "minimal", themeID: "min-gray-premium", colorFamily: "gray", tags: append(styles("minimal", "business"), append(scenarios("training"), stages("college")...)...)},
		{style: "minimal", themeID: "min-pure-white", colorFamily: "gray", tags: append(styles("minimal"), append(scenarios("general"), stages("primary", "junior", "senior")...)...)},
		{style: "minimal", themeID: "min-modern-line", colorFamily: "blue", tags: append(styles("minimal"), append(scenarios("lecture"), stages("junior", "senior")...)...)},
		{style: "minimal", themeID: "min-navy-intellectual", colorFamily: "blue", tags: append(styles("minimal", "academic"), append(subjects("math", "physics"), stages("senior", "college")...)...), subjects: sub("math", "physics")},
		{style: "tech", themeID: "te-quantum-blue", colorFamily: "blue", tags: append(styles("tech"), append(subjects("it", "physics"), stages("junior", "senior", "college")...)...), subjects: sub("it", "physics")},
		{style: "tech", themeID: "te-tech-navy", colorFamily: "blue", tags: append(styles("tech"), append(scenarios("open-class"), stages("senior", "college")...)...)},
		{style: "tech", themeID: "te-cyber-purple", colorFamily: "purple", tags: append(styles("tech"), append(subjects("it"), stages("junior", "senior")...)...), subjects: sub("it")},
		{style: "tech", themeID: "te-aurora-green", colorFamily: "cyan-green", tags: append(styles("tech"), append(subjects("science", "biology"), stages("junior", "senior")...)...), subjects: sub("science", "biology")},
		{style: "tech", themeID: "te-digital-cyan", colorFamily: "cyan-green", tags: append(styles("tech"), append(scenarios("first-class"), stages("primary", "junior")...)...)},
		{style: "fresh", themeID: "fr-mint", colorFamily: "cyan-green", tags: append(styles("fresh"), stages("kindergarten", "primary")...)},
		{style: "fresh", themeID: "fr-sky-blue", colorFamily: "blue", tags: append(styles("fresh"), append(scenarios("parents"), stages("kindergarten", "primary")...)...)},
		{style: "fresh", themeID: "fr-warm-orange", colorFamily: "warm", tags: append(styles("fresh"), stages("kindergarten", "primary")...)},
		{style: "fresh", themeID: "fr-macaron-pink", colorFamily: "purple", tags: append(styles("fresh"), append(subjects("art"), stages("kindergarten", "primary")...)...), subjects: sub("art")},
		{style: "fresh", themeID: "fr-sakura", colorFamily: "warm", tags: append(styles("fresh"), stages("primary", "junior")...)},
		{style: "academic", themeID: "aca-edu-blue", colorFamily: "blue", tags: append(styles("academic"), append(scenarios("lecture", "review"), stages("junior", "senior", "college")...)...)},
		{style: "academic", themeID: "aca-rational", colorFamily: "gray", tags: append(styles("academic"), append(subjects("math", "physics", "chemistry"), stages("senior", "college")...)...), subjects: sub("math", "physics", "chemistry")},
		{style: "academic", themeID: "aca-deep-green", colorFamily: "cyan-green", tags: append(styles("academic"), append(subjects("biology", "science"), stages("junior", "senior")...)...), subjects: sub("biology", "science")},
		{style: "academic", themeID: "aca-cream", colorFamily: "warm", tags: append(styles("academic"), stages("primary", "junior")...)},
		{style: "cartoon", themeID: "sp-cartoon", colorFamily: "gradient", tags: append(styles("cartoon"), append(pageTypes("cover", "content"), stages("kindergarten", "primary")...)...)},
		{style: "cartoon", themeID: "sp-doodle", colorFamily: "gradient", tags: append(styles("cartoon"), append(scenarios("class-meeting"), append(pageTypes("content", "summary"), stages("kindergarten", "primary")...)...)...)},
		{style: "cartoon", themeID: "gr-orange-pink", colorFamily: "gradient", tags: append(styles("cartoon"), append(subjects("art", "english"), append(pageTypes("cover", "content", "homework"), stages("kindergarten", "primary")...)...)...), subjects: sub("art", "english")},
		{style: "cartoon", themeID: "fr-macaron-pink", colorFamily: "purple", tags: append(styles("cartoon"), append(subjects("art"), append(pageTypes("cover", "content"), stages("kindergarten", "primary", "junior")...)...)...), subjects: sub("art")},
		{style: "cartoon", themeID: "fr-warm-orange", colorFamily: "warm", tags: append(styles("cartoon"), append(scenarios("first-class"), stages("kindergarten", "primary")...)...)},
		{style: "cartoon", themeID: "gr-gold-orange", colorFamily: "warm", tags: append(styles("cartoon"), append(subjects("pe", "art"), stages("kindergarten", "primary", "junior")...)...), subjects: sub("pe", "art")},
		{style: "cartoon", themeID: "sp-party-red", colorFamily: "red-gold", tags: append(styles("cartoon"), append(scenarios("class-meeting", "first-class"), append(subjects("politics"), stages("primary", "junior", "senior")...)...)...), subjects: sub("politics")},
		{style: "cartoon", themeID: "sp-festive", colorFamily: "red-gold", tags: append(styles("cartoon"), append(scenarios("class-meeting", "first-class"), append(subjects("chinese", "politics", "english"), stages("primary", "junior", "senior")...)...)...), subjects: sub("chinese", "politics", "english")},
		{style: "china", themeID: "zgf-classic-red", colorFamily: "red-gold", tags: append(styles("china"), append(scenarios("class-meeting", "first-class"), append(subjects("chinese", "history", "politics"), stages("junior", "senior")...)...)...), subjects: sub("chinese", "history", "politics")},
		{style: "china", themeID: "zgf-guochao", colorFamily: "red-gold", tags: append(styles("china"), append(scenarios("class-meeting"), stages("primary", "junior")...)...)},
		{style: "flat", themeID: "mo-haze-blue", colorFamily: "blue", tags: append(styles("flat"), stages("primary", "junior")...)},
		{style: "flat", themeID: "mo-gray-purple", colorFamily: "purple", tags: append(styles("flat"), append(subjects("art"), stages("primary", "junior")...)...), subjects: sub("art")},
		{style: "flat", themeID: "mo-bean-green", colorFamily: "cyan-green", tags: append(styles("flat"), append(subjects("science"), stages("primary", "junior")...)...), subjects: sub("science")},
		{style: "business", themeID: "gr-blue-purple", colorFamily: "purple", tags: append(styles("business"), append(scenarios("training", "parents"), stages("college")...)...)},
		{style: "business", themeID: "wa-elegant-purple", colorFamily: "purple", tags: append(styles("business"), append(scenarios("open-class"), stages("senior", "college")...)...)},
		{style: "basic", themeID: "min-classic-blue", colorFamily: "blue", tags: append(styles("basic"), scenarios("general")...)},
		{style: "basic", themeID: "min-pure-white", colorFamily: "gray", tags: append(styles("basic"), scenarios("general")...)},
		{style: "basic", themeID: "aca-edu-blue", colorFamily: "blue", tags: append(styles("basic"), scenarios("general")...)},
	}
}

// ── H5 模板定义（对齐前端 H5_TEMPLATE_DEFS，806-842 行）──
func h5Defs() []tplDef {
	return []tplDef{
		{style: "china", themeID: "zgf-guochao", colorFamily: "red-gold", tags: append(styles("china"), append(scenarios("first-class", "class-meeting"), stages("primary", "junior")...)...)},
		{style: "china", themeID: "zgf-shanshui", colorFamily: "cyan-green", tags: append(styles("china"), append(scenarios("general"), stages("junior", "senior")...)...)},
		{style: "china", themeID: "zgf-song-qing", colorFamily: "cyan-green", tags: append(styles("china"), append(subjects("chinese", "history"), stages("junior", "senior")...)...), subjects: sub("chinese", "history")},
		{style: "minimal", themeID: "min-pure-white", colorFamily: "gray", tags: append(styles("minimal"), append(scenarios("general"), stages("primary", "junior", "senior")...)...)},
		{style: "minimal", themeID: "min-modern-line", colorFamily: "blue", tags: append(styles("minimal"), append(scenarios("lecture"), stages("junior", "senior")...)...)},
		{style: "minimal", themeID: "min-navy-intellectual", colorFamily: "blue", tags: append(styles("minimal", "academic"), append(subjects("math"), stages("senior", "college")...)...), subjects: sub("math")},
		{style: "tech", themeID: "te-quantum-blue", colorFamily: "blue", tags: append(styles("tech"), append(subjects("it", "physics"), stages("junior", "senior", "college")...)...), subjects: sub("it", "physics")},
		{style: "tech", themeID: "te-aurora-green", colorFamily: "cyan-green", tags: append(styles("tech"), append(subjects("science"), stages("junior", "senior")...)...), subjects: sub("science")},
		{style: "tech", themeID: "te-digital-cyan", colorFamily: "cyan-green", tags: append(styles("tech"), append(scenarios("first-class"), stages("primary", "junior")...)...)},
		{style: "fresh", themeID: "fr-mint", colorFamily: "cyan-green", tags: append(styles("fresh"), stages("kindergarten", "primary")...)},
		{style: "fresh", themeID: "fr-sky-blue", colorFamily: "blue", tags: append(styles("fresh"), append(scenarios("parents"), stages("kindergarten", "primary")...)...)},
		{style: "fresh", themeID: "fr-warm-orange", colorFamily: "warm", tags: append(styles("fresh"), stages("kindergarten", "primary")...)},
		{style: "fresh", themeID: "fr-macaron-pink", colorFamily: "purple", tags: append(styles("fresh"), append(subjects("art"), stages("kindergarten", "primary")...)...), subjects: sub("art")},
		{style: "fresh", themeID: "fr-sakura", colorFamily: "warm", tags: append(styles("fresh"), stages("primary", "junior")...)},
		{style: "fresh", themeID: "fr-lemon", colorFamily: "gradient", tags: append(styles("fresh"), stages("kindergarten", "primary")...)},
		{style: "academic", themeID: "aca-edu-blue", colorFamily: "blue", tags: append(styles("academic"), append(scenarios("review"), stages("junior", "senior", "college")...)...)},
		{style: "academic", themeID: "aca-deep-green", colorFamily: "cyan-green", tags: append(styles("academic"), append(subjects("biology"), stages("junior", "senior")...)...), subjects: sub("biology")},
		{style: "cartoon", themeID: "sp-cartoon", colorFamily: "gradient", tags: append(styles("cartoon"), append(pageTypes("cover", "content"), stages("kindergarten", "primary")...)...)},
		{style: "cartoon", themeID: "sp-doodle", colorFamily: "gradient", tags: append(styles("cartoon"), append(scenarios("class-meeting"), append(pageTypes("content", "summary"), stages("kindergarten", "primary")...)...)...)},
		{style: "cartoon", themeID: "gr-orange-pink", colorFamily: "gradient", tags: append(styles("cartoon"), append(subjects("art", "english"), append(pageTypes("cover", "content", "homework"), stages("kindergarten", "primary")...)...)...), subjects: sub("art", "english")},
		{style: "cartoon", themeID: "fr-macaron-pink", colorFamily: "purple", tags: append(styles("cartoon"), append(subjects("art"), append(pageTypes("cover", "content"), stages("kindergarten", "primary", "junior")...)...)...), subjects: sub("art")},
		{style: "cartoon", themeID: "fr-warm-orange", colorFamily: "warm", tags: append(styles("cartoon"), append(scenarios("first-class"), stages("kindergarten", "primary")...)...)},
		{style: "cartoon", themeID: "gr-gold-orange", colorFamily: "warm", tags: append(styles("cartoon"), append(subjects("pe", "art"), stages("kindergarten", "primary", "junior")...)...), subjects: sub("pe", "art")},
		{style: "cartoon", themeID: "sp-party-red", colorFamily: "red-gold", tags: append(styles("cartoon"), append(scenarios("first-class", "class-meeting"), append(subjects("politics"), stages("kindergarten", "primary", "junior", "senior")...)...)...), subjects: sub("politics")},
		{style: "cartoon", themeID: "sp-festive", colorFamily: "red-gold", tags: append(styles("cartoon"), append(scenarios("class-meeting", "first-class"), append(subjects("chinese", "politics", "english"), stages("primary", "junior", "senior")...)...)...), subjects: sub("chinese", "politics", "english")},
		{style: "china", themeID: "zgf-classic-red", colorFamily: "red-gold", tags: append(styles("china"), append(scenarios("class-meeting", "first-class"), append(subjects("chinese", "history", "politics"), stages("junior", "senior")...)...)...), subjects: sub("chinese", "history", "politics")},
		{style: "china", themeID: "zgf-guochao", colorFamily: "red-gold", tags: append(styles("china"), append(scenarios("class-meeting"), stages("primary", "junior")...)...)},
		{style: "flat", themeID: "mo-haze-blue", colorFamily: "blue", tags: append(styles("flat"), stages("primary", "junior")...)},
		{style: "flat", themeID: "mo-gray-purple", colorFamily: "purple", tags: append(styles("flat"), append(subjects("art"), stages("primary", "junior")...)...), subjects: sub("art")},
		{style: "flat", themeID: "mo-bean-green", colorFamily: "cyan-green", tags: append(styles("flat"), append(subjects("science"), stages("primary", "junior")...)...), subjects: sub("science")},
		{style: "flat", themeID: "mo-rose-gray", colorFamily: "purple", tags: append(styles("flat"), stages("primary", "junior")...)},
		{style: "business", themeID: "gr-blue-purple", colorFamily: "purple", tags: append(styles("business"), append(scenarios("training"), stages("college")...)...)},
		{style: "business", themeID: "wa-elegant-purple", colorFamily: "purple", tags: append(styles("business"), append(scenarios("open-class"), stages("senior", "college")...)...)},
		{style: "basic", themeID: "min-pure-white", colorFamily: "gray", tags: append(styles("basic"), scenarios("general")...)},
		{style: "basic", themeID: "aca-edu-blue", colorFamily: "blue", tags: append(styles("basic"), scenarios("general")...)},
	}
}

func sub(v ...string) []string { return v }
