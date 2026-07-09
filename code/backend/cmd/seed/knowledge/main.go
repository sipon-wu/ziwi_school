package main

// 知识库初始化种子程序（数据团队 v0.7 产物）
// 读取 build_knowledge_artifacts.py 产出的 knowledge_seed.json（规范化列名对齐 DB），
// 内存维护 version_key / node_key -> 自增 id 映射按层级插入，规避 PG 下单条 INSERT
// 同表子查询看不到未提交行（parent_id 全 NULL）的问题。
// 可重跑：启动先 TRUNCATE 5 张 tb_* 表（一次性初始化，非用户数据）。

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"

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
	TextbookVersions   []tvSeed `json:"textbook_versions"`
	StandardClauses    []scSeed `json:"standard_clauses"`
	VersionStandardMaps []vsSeed `json:"version_standard_maps"`
	KGNodes            []knSeed `json:"kg_nodes"`
	KGEdges            []keSeed `json:"kg_edges"`
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
	XueDuan       string `json:"xue_duan"`
	XueKe         string `json:"xue_ke"`
	TiaoMuLuJing  string `json:"tiao_mu_lu_jing"`
	YeZiBianHao   string `json:"ye_zi_bian_hao"`
	ZhengWen      string `json:"zheng_wen"`
}
type vsSeed struct {
	VersionKey    string `json:"version_key"`
	DanYuan       string `json:"dan_yuan"`
	KeBiaoTiaoMu  string `json:"ke_biao_tiao_mu"`
	PiPeiDu       string `json:"pi_pei_du"`
	ZhiShiDian    string `json:"zhi_shi_dian"`
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
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	must(err, "connect db")

	// ── 确保表结构 ──
	must(db.AutoMigrate(
		&model.TextbookVersion{}, &model.StandardClause{},
		&model.VersionStandardMap{}, &model.KGNode{}, &model.KGEdge{},
	), "automigrate knowledge tables")

	// ── 清旧（一次性初始化，非运行期用户数据）──
	log.Println("[init] 清空 tb_* 知识库表 ...")
	for _, t := range []string{
		"tb_kg_edge", "tb_kg_node", "tb_version_standard_map",
		"tb_standard_clause", "tb_textbook_version",
	} {
		if err := db.Exec("TRUNCATE TABLE " + t + " RESTART IDENTITY CASCADE").Error; err != nil {
			log.Fatalf("truncate %s: %v", t, err)
		}
	}

	// ── 1. 教材版本 ──
	log.Printf("[init] 插入教材版本 %d ...", len(s.TextbookVersions))
	verKey2ID := make(map[string]int64, len(s.TextbookVersions))
	for _, t := range s.TextbookVersions {
		rec := model.TextbookVersion{
			VersionKey: t.VersionKey, XueDuan: t.XueDuan, NianJi: t.NianJi, XueKe: t.XueKe,
			JiaoCaiMing: t.JiaoCaiMing, ChuBanShe: t.ChuBanShe, BanBenBiaoShi: t.BanBenBiaoShi,
			CeBie: t.CeBie, MuLuURL: t.MuLuURL, Inferred: t.Inferred,
		}
		must(db.Create(&rec).Error, "create textbook_version "+t.VersionKey)
		verKey2ID[t.VersionKey] = rec.ID
	}

	// ── 2. 课标条款 ──
	log.Printf("[init] 插入课标条款 %d ...", len(s.StandardClauses))
	clausePath2ID := make(map[string]int64, len(s.StandardClauses))
	for _, c := range s.StandardClauses {
		rec := model.StandardClause{
			XueDuan: c.XueDuan, XueKe: c.XueKe, TiaoMuLuJing: c.TiaoMuLuJing,
			YeZiBianHao: c.YeZiBianHao, ZhengWen: c.ZhengWen,
		}
		must(db.Create(&rec).Error, "create standard_clause")
		// 按路径索引（映射表用 ke_biao_tiao_mu 即路径匹配）
		if _, ok := clausePath2ID[c.TiaoMuLuJing]; !ok {
			clausePath2ID[c.TiaoMuLuJing] = rec.ID
		}
	}

	// ── 3. 教材-课标映射 ──
	log.Printf("[init] 插入教材-课标映射 %d ...", len(s.VersionStandardMaps))
	missClause, missVer := 0, 0
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
		rec := model.VersionStandardMap{
			VersionID: vid, DanYuan: m.DanYuan, StandardClauseID: cid,
			PiPeiDu: m.PiPeiDu, ZhiShiDian: m.ZhiShiDian,
		}
		must(db.Create(&rec).Error, "create version_standard_map")
	}
	if missVer > 0 || missClause > 0 {
		log.Printf("[warn] 映射缺失引用: 未知版本=%d, 未知课标路径=%d", missVer, missClause)
	}

	// ── 4. 知识图谱节点（先插，parent_id 留空，再回填）──
	log.Printf("[init] 插入知识图谱节点 %d ...", len(s.KGNodes))
	nodeKey2ID := make(map[string]int64, len(s.KGNodes))
	for _, n := range s.KGNodes {
		vid, ok := verKey2ID[n.VersionKey]
		if !ok {
			// 节点引用了未知版本，跳过但记录
			log.Printf("[warn] 节点 %s 引用未知版本 %s，跳过", n.NodeKey, n.VersionKey)
			continue
		}
		rec := model.KGNode{
			NodeKey: n.NodeKey, VersionID: vid, DanYuan: n.DanYuan,
			MingCheng: n.MingCheng, Level: n.Level,
			QianZhi: qianZhiJSON(n.QianZhi), NanDu: n.NanDu, NengLiWeiDu: n.NengLiWeiDu,
		}
		must(db.Create(&rec).Error, "create kg_node "+n.NodeKey)
		nodeKey2ID[n.NodeKey] = rec.ID
	}
	// 回填 parent_id
	updParent := 0
	for _, n := range s.KGNodes {
		if n.ParentKey == "" {
			continue
		}
		pid, ok := nodeKey2ID[n.ParentKey]
		if !ok {
			continue
		}
		childID, ok := nodeKey2ID[n.NodeKey]
		if !ok {
			continue
		}
		if err := db.Model(&model.KGNode{}).Where("id = ?", childID).Update("parent_id", pid).Error; err != nil {
			log.Printf("[warn] 回填 parent_id 失败 %s: %v", n.NodeKey, err)
			continue
		}
		updParent++
	}
	log.Printf("[init] 回填 parent_id %d 条", updParent)

	// ── 5. 知识图谱边 ──
	log.Printf("[init] 插入知识图谱边 %d ...", len(s.KGEdges))
	missEdge := 0
	for _, e := range s.KGEdges {
		fid, ok1 := nodeKey2ID[e.FromKey]
		tid, ok2 := nodeKey2ID[e.ToKey]
		if !ok1 || !ok2 {
			missEdge++
			continue
		}
		rec := model.KGEdge{FromID: fid, ToID: tid, RelationType: e.RelationType}
		must(db.Create(&rec).Error, "create kg_edge")
	}
	if missEdge > 0 {
		log.Printf("[warn] 边缺失端点引用 %d 条", missEdge)
	}

	fmt.Println("\n=== 知识库初始化完成 ===")
	fmt.Printf("教材版本: %d\n课标条款: %d\n教材-课标映射: %d\n知识节点: %d\n知识边: %d\n",
		len(s.TextbookVersions), len(s.StandardClauses), len(s.VersionStandardMaps),
		len(s.KGNodes), len(s.KGEdges))
	fmt.Println("Seed OK!")
}
