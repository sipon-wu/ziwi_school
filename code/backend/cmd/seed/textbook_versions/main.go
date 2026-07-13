package main

// 教材版本种子导入程序（数据团队 v4 交付包产出）
// 读取 textbook_versions_seed.json（仅教材版本表），
// TRUNCATE tb_textbook_version 后批量插入。
// 请在运行 knowledge/main.go 之前先跑本程序。
//
// 用法:
//   DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=disable go run main.go
//   # 或使用环境变量 DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME
//
// 数据源: code/backend/data/textbook_versions_seed.json (K12, 已剔除特殊教育)

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

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

type tvSeed struct {
	VersionKey    string `json:"version_key"`
	XueDuan       string `json:"xue_duan"`
	NianJi        string `json:"nian_ji"`
	XueKe         string `json:"xue_ke"`
	JiaoCaiMing   string `json:"jiao_cai_ming"`
	ChuBanShe     string `json:"chu_ban_she"`
	BanBenBiaoShi string `json:"ban_ben_biao_shi"`
	CeBie         string `json:"ce_bie"`
	MuLuURL       string `json:"mu_lu_url"`
	Inferred      bool   `json:"inferred"`
}

func findSeed() string {
	if p := os.Getenv("TEXTBOOK_VERSIONS_SEED"); p != "" {
		return p
	}
	exe, err := os.Executable()
	cands := []string{}
	if err == nil {
		cands = append(cands, filepath.Join(filepath.Dir(exe), "..", "..", "data", "textbook_versions_seed.json"))
	}
	cands = append(cands,
		filepath.Join("..", "..", "data", "textbook_versions_seed.json"),
		filepath.Join("data", "textbook_versions_seed.json"),
		"textbook_versions_seed.json",
	)
	for _, c := range cands {
		if _, err := os.Stat(c); err == nil {
			abs, _ := filepath.Abs(c)
			return abs
		}
	}
	log.Fatalf("找不到 textbook_versions_seed.json，请用 TEXTBOOK_VERSIONS_SEED 指定路径")
	return ""
}

func main() {
	// ── 读数据 ──
	seedPath := findSeed()
	log.Printf("[init] 读取 %s ...", seedPath)
	raw, err := os.ReadFile(seedPath)
	must(err, "read seed json: "+seedPath)
	var versions []tvSeed
	must(json.Unmarshal(raw, &versions), "parse seed json")
	log.Printf("[init] 共 %d 条教材版本 (K12, 已剔除特殊教育)", len(versions))

	// ── 连库 ──
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		host := getEnv("DB_HOST", "postgres")
		port := getEnv("DB_PORT", "5432")
		user := getEnv("DB_USER", "zhiwei")
		pass := getEnv("DB_PASSWORD", "zhiwei2026")
		dbname := getEnv("DB_NAME", "zhiwei")
		dsn = "postgresql://" + user + ":" + pass + "@" + host + ":" + port + "/" + dbname + "?sslmode=disable"
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	must(err, "connect db")

	// ── 确保表结构 ──
	must(db.AutoMigrate(&model.TextbookVersion{}), "automigrate tb_textbook_version")

	// ── 清旧 ──
	log.Println("[init] TRUNCATE tb_textbook_version ...")
	must(db.Exec("TRUNCATE TABLE tb_textbook_version RESTART IDENTITY CASCADE").Error, "truncate")

	// ── 批量插入 ──
	recs := make([]model.TextbookVersion, 0, len(versions))
	for _, v := range versions {
		recs = append(recs, model.TextbookVersion{
			VersionKey:    v.VersionKey,
			XueDuan:       v.XueDuan,
			NianJi:        v.NianJi,
			XueKe:         v.XueKe,
			JiaoCaiMing:   v.JiaoCaiMing,
			ChuBanShe:     v.ChuBanShe,
			BanBenBiaoShi: v.BanBenBiaoShi,
			CeBie:         v.CeBie,
			MuLuURL:       v.MuLuURL,
			Inferred:      v.Inferred,
		})
	}
	must(db.CreateInBatches(&recs, 200).Error, "batch insert textbook_versions")

	// ── 验证 ──
	var count int64
	db.Model(&model.TextbookVersion{}).Count(&count)
	log.Printf("[done] tb_textbook_version 共 %d 条, 种子文件 %d 条", count, len(versions))

	// 打印学段分布
	var segs []struct {
		XueDuan string
		Cnt     int
	}
	db.Model(&model.TextbookVersion{}).
		Select("xue_duan, count(*) as cnt").
		Group("xue_duan").Order("cnt desc").Scan(&segs)
	fmt.Println("\n按学段分布:")
	for _, s := range segs {
		fmt.Printf("  %s: %d\n", s.XueDuan, s.Cnt)
	}
}
