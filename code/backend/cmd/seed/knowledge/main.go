package main

// 知识库初始化种子程序（数据团队 v0.7 产物）
// 读取 build_knowledge_artifacts.py 产出的 knowledge_seed.json（规范化列名对齐 DB），
// 内存维护 version_key / node_key -> 自增 id 映射，按层级批量插入：
//   - 教材版本 / 课标条款 / 映射 / 节点 / 边 全部用 GORM CreateInBatches 批量写入
//   - parent_id 通过单条 CASE 语句一次性回填，规避 PG 同表子查询与逐行回写的高延迟
// 可重跑：启动先 TRUNCATE 5 张 tb_* 表（一次性初始化，非用户数据）。

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

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

func loggerSilent() logger.Interface {
	return logger.Default.LogMode(logger.Silent)
}

// findSeed 定位 knowledge_seed.json：优先环境变量，其次相对可执行文件 / 工作目录
func findSeed() string {
	if p := os.Getenv("KNOWLEDGE_SEED"); p != "" {
		return p
	}
	exe, err := os.Executable()
	cands := []string{}
	if err == nil {
		cands = append(cands, filepath.Join(filepath.Dir(exe), "..", "..", "data", "knowledge_seed.json"))
	}
	cands = append(cands,
		filepath.Join("..", "..", "data", "knowledge_seed.json"),
		filepath.Join("data", "knowledge_seed.json"),
		"knowledge_seed.json",
	)
	for _, c := range cands {
		if _, err := os.Stat(c); err == nil {
			abs, _ := filepath.Abs(c)
			return abs
		}
	}
	log.Fatalf("找不到 knowledge_seed.json，请用 KNOWLEDGE_SEED 指定路径")
	return ""
}

// ── JSON 结构（键名对齐 build 脚本产出）──
type seedJSON struct {
	TextbookVersions    []tvSeed `json:"textbook_versions"`
	StandardClauses     []scSeed `json:"standard_clauses"`
	VersionStandardMaps []vsSeed `json:"version_standard_maps"`
	KGNodes             []knSeed `json:"kg_nodes"`
	KGEdges             []keSeed `json:"kg_edges"`
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
type scSeed struct {
	XueDuan      string `json:"xue_duan"`
	XueKe        string `json:"xue_ke"`
	TiaoMuLuJing string `json:"tiao_mu_lu_jing"`
	YeZiBianHao  string `json:"ye_zi_bian_hao"`
	ZhengWen     string `json:"zheng_wen"`
}
type vsSeed struct {
	VersionKey   string `json:"version_key"`
	DanYuan      string `json:"dan_yuan"`
	KeBiaoTiaoMu string `json:"ke_biao_tiao_mu"`
	PiPeiDu      string `json:"pi_pei_du"`
	ZhiShiDian   string `json:"zhi_shi_dian"`
}
type knSeed struct {
	NodeKey     string   `json:"node_key"`
	VersionKey  string   `json:"version_key"`
	DanYuan     string   `json:"dan_yuan"`
	ParentKey   string   `json:"parent_key"`
	MingCheng   string   `json:"ming_cheng"`
	Level        int      `json:"level"`
	QianZhi     []string `json:"qian_zhi"`
	NanDu       string   `json:"nan_du"`
	NengLiWeiDu string   `json:"neng_li_wei_du"`
}
type keSeed struct {
	FromKey      string `json:"from_key"`
	ToKey        string `json:"to_key"`
	RelationType string `json:"relation_type"`
}

func qianZhiJSON(q []string) string {
	if len(q) == 0 {
		return "[]"
	}
	b, _ := json.Marshal(q)
	return string(b)
}

func main() {
	// ── 读数据 ──
	seedPath := findSeed()
	raw, err := os.ReadFile(seedPath)
	must(err, "read seed json: "+seedPath)
	var s seedJSON
	must(json.Unmarshal(raw, &s), "parse seed json")

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
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: loggerSilent()})
	must(err, "connect db")

	// ── 确保表结构 ──
	must(db.AutoMigrate(
		&model.TextbookVersion{}, &model.StandardClause{},
		&model.VersionStandardMap{}, &model.KGNode{}, &model.KGEdge{},
	), "automigrate knowledge tables")

	// ── 清旧（tb_textbook_version 已由 textbook_versions seed 独立导入，此处跳过）──
	log.Println("[init] 清空 tb_* 知识库表（tb_textbook_version 跳过）...")
	for _, t := range []string{
		"tb_kg_edge", "tb_kg_node", "tb_version_standard_map", "tb_standard_clause",
	} {
		if err := db.Exec("TRUNCATE TABLE " + t + " RESTART IDENTITY CASCADE").Error; err != nil {
			log.Fatalf("truncate %s: %v", t, err)
		}
	}

	// ── 1. 从 DB 读取已有教材版本映射（由 textbook_versions seed 预热）──
	var existingTVs []model.TextbookVersion
	db.Model(&model.TextbookVersion{}).Find(&existingTVs)
	verKey2ID := make(map[string]int64, len(existingTVs))
	for _, r := range existingTVs {
		verKey2ID[r.VersionKey] = r.ID
	}
	log.Printf("[init] 从 DB 读取教材版本 %d 条（已由 textbook_versions seed 预热）", len(verKey2ID))

	// ── 2. 课标条款（批量）──
	log.Printf("[init] 插入课标条款 %d ...", len(s.StandardClauses))
	scRecs := make([]model.StandardClause, 0, len(s.StandardClauses))
	for _, c := range s.StandardClauses {
		scRecs = append(scRecs, model.StandardClause{
			XueDuan: c.XueDuan, XueKe: c.XueKe, TiaoMuLuJing: c.TiaoMuLuJing,
			YeZiBianHao: c.YeZiBianHao, ZhengWen: c.ZhengWen,
		})
	}
	must(db.CreateInBatches(&scRecs, 200).Error, "batch standard_clause")
	clausePath2ID := make(map[string]int64, len(scRecs))
	for _, r := range scRecs {
		if _, ok := clausePath2ID[r.TiaoMuLuJing]; !ok {
			clausePath2ID[r.TiaoMuLuJing] = r.ID
		}
	}

	// ── 3. 教材-课标映射（批量，跳过未知引用）──
	log.Printf("[init] 插入教材-课标映射 %d ...", len(s.VersionStandardMaps))
	vsRecs := make([]model.VersionStandardMap, 0, len(s.VersionStandardMaps))
	missVer, missClause := 0, 0
	for _, m := range s.VersionStandardMaps {
		vid, ok1 := verKey2ID[m.VersionKey]
		cid, ok2 := clausePath2ID[m.KeBiaoTiaoMu]
		if !ok1 {
			missVer++
			continue
		}
		if !ok2 {
			missClause++
		}
		vsRecs = append(vsRecs, model.VersionStandardMap{
			VersionID: vid, DanYuan: m.DanYuan, StandardClauseID: cid,
			PiPeiDu: m.PiPeiDu, ZhiShiDian: m.ZhiShiDian,
		})
	}
	must(db.CreateInBatches(&vsRecs, 200).Error, "batch version_standard_map")
	if missVer > 0 || missClause > 0 {
		log.Printf("[warn] 映射缺失引用: 未知版本=%d, 未知课标路径=%d", missVer, missClause)
	}

	// ── 4. 知识图谱节点（批量）──
	log.Printf("[init] 插入知识图谱节点 %d ...", len(s.KGNodes))
	knRecs := make([]model.KGNode, 0, len(s.KGNodes))
	skipNode := 0
	for _, n := range s.KGNodes {
		vid, ok := verKey2ID[n.VersionKey]
		if !ok {
			skipNode++
			continue
		}
		knRecs = append(knRecs, model.KGNode{
			NodeKey: n.NodeKey, VersionID: vid, DanYuan: n.DanYuan,
			MingCheng: n.MingCheng, Level: n.Level,
			QianZhi: qianZhiJSON(n.QianZhi), NanDu: n.NanDu, NengLiWeiDu: n.NengLiWeiDu,
		})
	}
	must(db.CreateInBatches(&knRecs, 300).Error, "batch kg_node")
	nodeKey2ID := make(map[string]int64, len(knRecs))
	for _, r := range knRecs {
		nodeKey2ID[r.NodeKey] = r.ID
	}
	if skipNode > 0 {
		log.Printf("[warn] 跳过未知版本的节点 %d 条", skipNode)
	}

	// ── 4b. parent_id 单条 CASE 语句一次性回填 ──
	type pidPair struct{ child, parent int64 }
	pairs := make([]pidPair, 0, len(s.KGNodes))
	for _, n := range s.KGNodes {
		if n.ParentKey == "" {
			continue
		}
		childID, ok1 := nodeKey2ID[n.NodeKey]
		parentID, ok2 := nodeKey2ID[n.ParentKey]
		if !ok1 || !ok2 {
			continue
		}
		pairs = append(pairs, pidPair{childID, parentID})
	}
	if len(pairs) > 0 {
		var b strings.Builder
		b.WriteString("UPDATE tb_kg_node AS t SET parent_id = c.parent_id FROM (VALUES ")
		vals := make([]string, 0, len(pairs))
		for _, p := range pairs {
			vals = append(vals, fmt.Sprintf("(%d,%d)", p.child, p.parent))
		}
		b.WriteString(strings.Join(vals, ","))
		b.WriteString(") AS c(id, parent_id) WHERE t.id = c.id")
		must(db.Exec(b.String()).Error, "batch update parent_id")
	}
	log.Printf("[init] 回填 parent_id %d 条", len(pairs))

	// ── 5. 知识图谱边（批量）──
	log.Printf("[init] 插入知识图谱边 %d ...", len(s.KGEdges))
	keRecs := make([]model.KGEdge, 0, len(s.KGEdges))
	missEdge := 0
	for _, e := range s.KGEdges {
		fid, ok1 := nodeKey2ID[e.FromKey]
		tid, ok2 := nodeKey2ID[e.ToKey]
		if !ok1 || !ok2 {
			missEdge++
			continue
		}
		keRecs = append(keRecs, model.KGEdge{FromID: fid, ToID: tid, RelationType: e.RelationType})
	}
	must(db.CreateInBatches(&keRecs, 300).Error, "batch kg_edge")
	if missEdge > 0 {
		log.Printf("[warn] 边缺失端点引用 %d 条", missEdge)
	}

	fmt.Println("\n=== 知识库初始化完成 ===")
	fmt.Printf("教材版本: %d\n课标条款: %d\n教材-课标映射: %d\n知识节点: %d\n知识边: %d\n",
		len(s.TextbookVersions), len(s.StandardClauses), len(s.VersionStandardMaps),
		len(s.KGNodes), len(s.KGEdges))
	fmt.Println("Seed OK!")
}
