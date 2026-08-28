package main

// 增强版演示种子数据（QA V2.4 专用）
// 账号与业务数据全部对齐 QA测试方案_正式版_20260707.md：
//   - 13800000002 / teacher123 —— 语文教师（主力测试账号，所有业务数据挂其名下）
//   - 13800000005 / teacher123 —— 校长
//   - 13800000001 / admin123   —— 管理员(it_admin)
// 业务数据规模：教案4 / 题目24 / 试卷3 / 素材8 / 成长关爱7 / 作业若干
// 所有统计接口按 teacher_id 过滤，故演示业务数据统一归属 13800000002。

import (
	"encoding/json"
	"fmt"
	"log"
	"net/url"
	"os"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/datatypes"
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

func must(err error, msg string) {
	if err != nil {
		log.Fatalf("%s: %v", msg, err)
	}
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

	// ── 1. 全量 AutoMigrate（保证表结构与运行时代码 model 一致）──
	must(db.AutoMigrate(
		&model.School{}, &model.Campus{}, &model.User{}, &model.Class{},
		&model.TeacherClass{}, &model.StudentClass{}, &model.LessonPlan{},
		&model.Exam{}, &model.Material{}, &model.ImportBatch{},
		&repository.Question{}, &repository.Assignment{},
		&model.TextbookVersion{}, &model.StandardClause{},
		&model.VersionStandardMap{}, &model.KGNode{}, &model.KGEdge{},
	), "automigrate")

	// 无 GORM model 但 QA 需要的表（按 001 schema 关键列建立）
	// 外键列类型必须对齐实际 PK：users/schools = varchar(30)，assignments = varchar(50)
	db.Exec(`CREATE TABLE IF NOT EXISTS growth_care_records (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		student_id VARCHAR(30) REFERENCES users(id),
		teacher_id VARCHAR(30) REFERENCES users(id),
		school_id VARCHAR(30) REFERENCES schools(id),
		current_status TEXT,
		data_basis JSONB,
		ai_assessment TEXT,
		teacher_observation TEXT,
		weekly_plan JSONB,
		plan_status VARCHAR(20) DEFAULT 'draft',
		kindness_reviewed BOOLEAN DEFAULT FALSE,
		parent_notified BOOLEAN DEFAULT FALSE,
		parent_confirmed BOOLEAN DEFAULT FALSE,
		teacher_group VARCHAR(50),
		created_at TIMESTAMPTZ DEFAULT NOW(),
		updated_at TIMESTAMPTZ DEFAULT NOW()
	)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS parent_signatures (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		parent_id VARCHAR(30) REFERENCES users(id),
		student_id VARCHAR(30) REFERENCES users(id),
		assignment_id VARCHAR(50) REFERENCES assignments(id),
		signed_at TIMESTAMPTZ DEFAULT NOW(),
		reminded_at TIMESTAMPTZ
	)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS submissions (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		assignment_id VARCHAR(50) REFERENCES assignments(id),
		student_id VARCHAR(30) REFERENCES users(id),
		answers JSONB,
		submitted_at TIMESTAMPTZ DEFAULT NOW()
	)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS grading_results (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		submission_id UUID REFERENCES submissions(id),
		question_id VARCHAR(50),
		ai_score DECIMAL(5,2),
		ai_confidence DECIMAL(4,3),
		status VARCHAR(20) DEFAULT 'pending',
		graded_at TIMESTAMPTZ
	)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS student_observations (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		student_id VARCHAR(30) REFERENCES users(id),
		teacher_id VARCHAR(30) REFERENCES users(id),
		school_id VARCHAR(30) REFERENCES schools(id),
		description TEXT,
		observed_at TIMESTAMPTZ DEFAULT NOW()
	)`)

	// ── 2. 清空演示数据（演示库，CASCADE 安全）──
	for _, t := range []string{
		"growth_care_records", "parent_signatures", "submissions", "grading_results",
		"student_observations", "lesson_plans", "questions", "exams", "materials",
		"assignments", "teacher_classes", "student_classes", "classes", "users", "schools",
	} {
		db.Exec("TRUNCATE TABLE " + t + " CASCADE")
	}

	now := time.Now()

	// ── 3. 学校 ──
	school := model.School{
		ID:         "sch-0001",
		FullName:   "树人实验小学",
		ShortName:  "树人实验",
		SystemType: "六三制",
		Region:     "北京市海淀区",
		Status:     "active",
	}
	must(db.Create(&school).Error, "create school")

	// ── 4. 用户（bcrypt 正确密码）──
	type uSeed struct {
		ID       string
		Phone    string
		Name     string
		Role     string
		Password string
	}
	users := []uSeed{
		{"u-admin", "13800000001", "赵管理员", "it_admin", "admin123"},
		{"u-teacher", "13800000002", "李老师", "teacher", "teacher123"},
		{"u-math", "13800000003", "王老师", "teacher", "teacher123"},
		{"u-eng", "13800000004", "陈老师", "teacher", "teacher123"},
		{"u-principal", "13800000005", "赵校长", "principal", "teacher123"},
		{"u-head", "13800000006", "周班主任", "head_teacher", "teacher123"},
		{"u-registrar", "13800000007", "刘教务", "registrar", "teacher123"},
		{"u-research", "13800000008", "李教研", "research_lead", "teacher123"},
	}
	for _, u := range users {
		hash, e := bcrypt.GenerateFromPassword([]byte(u.Password), bcrypt.DefaultCost)
		must(e, "hash")
		user := model.User{
			ID:           u.ID,
			SchoolID:     &school.ID,
			Phone:        u.Phone,
			PasswordHash: string(hash),
			Role:         u.Role,
			Name:         u.Name,
			StyleProfile: "{}",
			Status:       "active",
		}
		must(db.Create(&user).Error, "create user "+u.Phone)
	}

	// 学生（固定 ID，便于家长签字/成长关爱引用）
	// 没有学生端，由家长端代理：学生仅为花名册记录（姓名+学号+班级），
	// 无手机号（占位哨兵）、无密码（空哈希不可登录）。严禁再给学生写登录凭据。
	for i := 1; i <= 15; i++ {
		id := fmt.Sprintf("s-%04d", i)
		sno := fmt.Sprintf("%03d", i)
		user := model.User{
			ID:            id,
			SchoolID:      &school.ID,
			Phone:         "stu_demo_" + sno, // 占位哨兵，非真实手机号（varchar(20) 内）
			PasswordHash:  "",                             // 空哈希 = 不可登录
			Role:          "student",
			Name:          fmt.Sprintf("学生%02d", i),
			StudentNumber: &sno,
			StyleProfile:  "{}",
			Status:        "active",
		}
		must(db.Create(&user).Error, "create student "+id)
	}

	// 家长（登录入口；每名花名册学生预留一名家长账号。家长端未开通的先占位：空密码不可登录，status=pending）
	// 前 2 名为已开通的演示家长（用于签字），phone 沿用旧学生登录号段 1390101xxx。
	for i := 1; i <= 15; i++ {
		pid := fmt.Sprintf("p-%04d", i)
		phone := fmt.Sprintf("1390101%03d", i)
		ph, st := "", "pending" // 预留：不可登录
		if i <= 2 {
			hash, _ := bcrypt.GenerateFromPassword([]byte("parent123"), bcrypt.DefaultCost)
			ph, st = string(hash), "active"
		}
		user := model.User{
			ID:           pid,
			SchoolID:     &school.ID,
			Phone:        phone,
			PasswordHash: ph,
			Role:         "parent",
			Name:         fmt.Sprintf("学生%02d家长", i),
			StyleProfile: "{}",
			Status:       st,
		}
		must(db.Create(&user).Error, "create parent "+pid)
	}
	// 家长-学生绑定（parent_students）
	db.Exec(`CREATE TABLE IF NOT EXISTS parent_students (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		parent_id VARCHAR(30) REFERENCES users(id) NOT NULL,
		student_id VARCHAR(30) REFERENCES users(id) NOT NULL,
		relationship VARCHAR(20) DEFAULT 'parent',
		is_primary BOOLEAN DEFAULT TRUE,
		UNIQUE (parent_id, student_id)
	)`)
	for i := 1; i <= 15; i++ {
		must(db.Exec(`INSERT INTO parent_students (parent_id, student_id) VALUES (?, ?) ON CONFLICT DO NOTHING`,
			fmt.Sprintf("p-%04d", i), fmt.Sprintf("s-%04d", i)).Error, "bind parent_student")
	}

	// ── 5. 班级 ──
	classes := []model.Class{
		{ID: "c-001", SchoolID: school.ID, Name: "四年级(1)班", Grade: "四年级", ClassType: "normal", HeadTeacherID: ptr("u-head")},
		{ID: "c-002", SchoolID: school.ID, Name: "四年级(2)班", Grade: "四年级", ClassType: "normal"},
		{ID: "c-003", SchoolID: school.ID, Name: "五年级(1)班", Grade: "五年级", ClassType: "normal"},
	}
	for _, c := range classes {
		must(db.Create(&c).Error, "create class "+c.ID)
	}

	// ── 6. 教师-班级-学科 ──
	tcs := []model.TeacherClass{
		{TeacherID: "u-teacher", ClassID: "c-001", Subject: "语文", IsPrimary: true},
		{TeacherID: "u-teacher", ClassID: "c-002", Subject: "语文", IsPrimary: true},
		{TeacherID: "u-math", ClassID: "c-001", Subject: "数学"},
		{TeacherID: "u-math", ClassID: "c-002", Subject: "数学"},
		{TeacherID: "u-eng", ClassID: "c-003", Subject: "英语"},
	}
	for _, tc := range tcs {
		must(db.Create(&tc).Error, "create teacher_class")
	}

	// ── 7. 学生-班级 ──
	for i := 1; i <= 15; i++ {
		id := fmt.Sprintf("s-%04d", i)
		classID := "c-001"
		if i > 10 {
			classID = "c-002"
		}
		sc := model.StudentClass{StudentID: id, ClassID: classID, EnrolledAt: now}
		must(db.Create(&sc).Error, "create student_class")
	}

	teacherID := "u-teacher"

	// ── 8. 教案 4（语文/四年级，2 final + 2 draft）──
	lessons := []model.LessonPlan{
		{
			TeacherID: teacherID, SchoolID: school.ID, Subject: "语文", Grade: "四年级",
			Title: "《观潮》第一课时", Unit: "第一单元", LessonPeriod: 1, TemplateType: "core_literacy",
			Content: `## 教学目标
- **知识与技能**：理解课文按时间顺序（潮来前、潮来时、潮头过后）描写钱塘江大潮的写法
- **过程与方法**：通过朗读与圈画，品味比喻、夸张等修辞的表达效果
- **情感态度与价值观**：感受钱塘江大潮的壮观，激发对祖国山河的热爱

## 教学重点
理解按时间顺序描写景物的方法，积累描写潮水的词句

## 教学难点
体会"浪潮越来越近，犹如千万匹白色战马齐头并进"等句子的表达效果

## 教学过程

### 一、情境导入（5分钟）
播放钱塘江大潮视频，引导学生说出观后感受，板书课题《观潮》

### 二、初读感知（15分钟）
自由朗读课文，圈画生字词，学习"盐、笼、罩、沸、震"等生字；理清"潮来前—潮来时—潮头过后"的写作顺序

### 三、精读品悟（15分钟）
重点品读第3、4自然段，抓住"白线—水墙—战马"的变化，体会作者由远及近的观察顺序与比喻的妙处

### 四、总结布置（5分钟）
总结写作顺序，布置作业：抄写生字词，背诵第3、4自然段

## 作业布置
抄写本课生字词；有感情朗读课文，背诵第3、4自然段`,
			KnowledgeNodes:  `["kn-1","kn-2"]`,
			CurriculumAlign: `[{"code":"3.2.1","content":"联系上下文理解词句","aligned":true}]`,
			AIGenerated:     true, AIModelVersion: "qwen-plus", GenerationTimeMs: 1200, EditCount: 2,
			ReviewStatus: "none", Status: "final",
		},
		{
			TeacherID: teacherID, SchoolID: school.ID, Subject: "语文", Grade: "四年级",
			Title: "《桂花雨》精读", Unit: "第一单元", LessonPeriod: 1, TemplateType: "core_literacy",
			Content: `## 教学目标
- **知识与技能**：理解课文内容，体会作者借桂花寄托的思乡之情
- **过程与方法**：抓住"桂花香""摇花乐"等场景，学习借物抒情的写法
- **情感态度与价值观**：感受童年生活的美好与浓浓的思乡情

## 教学重点
理解"摇花乐"场景中蕴含的快乐与怀念

## 教学难点
体会"这里的桂花再香，也比不上家乡院子里的桂花"一句中母亲的思乡情

## 教学过程

### 一、谈话导入（5分钟）
展示桂花图片，请学生说说对桂花的印象，引出课题

### 二、初读课文（12分钟）
自由朗读，圈画生字词；说说课文围绕桂花写了哪几件事

### 三、精读感悟（18分钟）
聚焦"摇花乐"段落，想象画面，朗读体会快乐；对比母亲的话，感受思乡之情

### 四、总结升华（5分钟）
总结借物抒情写法，布置小练笔

## 作业布置
摘抄描写桂花香的句子；仿照课文写一种寄托感情的植物`,
			KnowledgeNodes: `["kn-3"]`, CurriculumAlign: `[{"code":"3.2.2","content":"把握主要内容","aligned":true}]`,
			AIGenerated: true, AIModelVersion: "qwen-plus", GenerationTimeMs: 980, EditCount: 1,
			ReviewStatus: "none", Status: "final",
		},
		{
			TeacherID: teacherID, SchoolID: school.ID, Subject: "语文", Grade: "四年级",
			Title: "《走月亮》赏析", Unit: "第一单元", LessonPeriod: 2, TemplateType: "core_literacy",
			Content: `## 教学目标
- **知识与技能**：正确流利有感情地朗读课文，体会月下景物描写的美
- **过程与方法**：边读边想象画面，积累优美语句
- **情感态度与价值观**：感受"我"和阿妈走月亮的温馨与幸福

## 教学重点
想象月下溪边、田埂的美好画面

## 教学难点
体会"我和阿妈走月亮"反复出现的表达效果

## 教学过程

### 一、初读课文（15分钟）
自由朗读，读准字音，说说"走月亮"是什么意思

### 二、品读想象（20分钟）
默读课文，画出喜欢的句子，交流月光下的画面；重点品读溪边一段

### 三、小结（5分钟）
朗读积累，摘抄优美语句

## 作业布置
摘抄课文中描写月夜的优美句子，和家人一起"走月亮"并记录感受`,
			KnowledgeNodes: `["kn-4"]`, CurriculumAlign: `[]`,
			AIGenerated: false, GenerationTimeMs: 0, EditCount: 3,
			ReviewStatus: "none", Status: "draft",
		},
		{
			TeacherID: teacherID, SchoolID: school.ID, Subject: "语文", Grade: "四年级",
			Title: "《繁星》阅读", Unit: "第二单元", LessonPeriod: 1, TemplateType: "core_literacy",
			Content: `## 教学目标
- **知识与技能**：了解作者三次看繁星的不同感受
- **过程与方法**：比较阅读，体会随时间地点变化情感的变化
- **情感态度与价值观**：感受作者对星空、对大自然的热爱

## 教学重点
梳理三次看繁星的时间、地点与感受

## 教学难点
理解"我仿佛看见它们在对我霎眼，我仿佛听见它们在小声说话"的意境

## 教学过程

### 一、导入（5分钟）
出示星空图片，请学生谈谈观星感受，引出课题

### 二、初读梳理（15分钟）
默读课文，完成表格：三次看繁星的时间、地点、感受

### 三、品读感悟（15分钟）
重点品读第三段，闭眼想象海上看星的画面，体会作者的陶醉

### 四、拓展（5分钟）
交流自己的观星经历，仿写一句"我仿佛……"

## 作业布置
背诵第三自然段；观察夜空，写一段观星的话`,
			KnowledgeNodes: `["kn-5"]`, CurriculumAlign: `[]`,
			AIGenerated: false, GenerationTimeMs: 0, EditCount: 1,
			ReviewStatus: "none", Status: "draft",
		},
	}
	for _, lp := range lessons {
		must(db.Create(&lp).Error, "create lesson_plan")
	}

	// ── 9. 题目 24（语文/四年级，混合选择/填空/解答）──
	type qSeed struct {
		content string
		qtype   string
		diff    string
		options string
		answer  string
	}
	qdata := []qSeed{
		{"《观潮》的作者是谁？", "choice", "L2", `["巴金","叶圣陶","老舍","冰心"]`, "叶圣陶"},
		{"《观潮》按照____、____、____的顺序描写大潮。", "fill", "L2", `[]`, "来前|来时|过后"},
		{"下列加点字读音正确的是？", "choice", "L1", `["霎时(shà)","薄雾(báo)","鼎沸(dǐng)","横贯(héng)"]`, "鼎沸"},
		{"请用一句话概括《观潮》的主要内容。", "essay", "L3", `[]`, "课文描写了钱塘江大潮由远及近的壮观景象。"},
		{"《桂花雨》中作者借什么表达对故乡的思念？", "choice", "L2", `["桂花","梅花","兰花","菊花"]`, "桂花"},
		{"《桂花雨》中\"摇花乐\"体现了作者____的心情。", "fill", "L2", `[]`, "快乐"},
		{"下列词语书写完全正确的是？", "choice", "L1", `["迫不及待","再接再励","金壁辉煌","专心至志"]`, "迫不及待"},
		{"仿写：选择一种花，写一句话表达情感。", "essay", "L3", `[]`, "荷花亭亭玉立，让我想起母亲的温柔。"},
		{"《走月亮》描写的是哪里的景色？", "choice", "L2", `["洱海","西湖","洞庭湖","太湖"]`, "洱海"},
		{"《走月亮》中\"啊，我和阿妈走月亮\"在文中出现了____次。", "fill", "L2", `[]`, "4"},
		{"下列句子用了比喻修辞的是？", "choice", "L1", `["月亮像玉盘","他跑得快","花开了","风吹过"]`, "月亮像玉盘"},
		{"写一段描写秋天景色的文字（不少于30字）。", "essay", "L2", `[]`, "秋天来了，枫叶红了，稻谷弯了腰，空气中弥漫着桂花的清香。"},
		{"《繁星》的作者是？", "choice", "L3", `["巴金","鲁迅","茅盾","郭沫若"]`, "巴金"},
		{"《普罗米修斯》中，普罗米修斯从____那里盗取火种。", "fill", "L2", `[]`, "太阳神"},
		{"下列加点字解释正确的是？", "choice", "L2", `["题西林壁（书写）","缘（因为）","逊（谦虚）","骚（举止）"]`, "缘"},
		{"谈谈你对\"不识庐山真面目，只缘身在此山中\"的理解。", "essay", "L3", `[]`, "置身事中往往看不清全貌，应跳出局限客观看待。"},
		{"下列词语中描写人物品质的是？", "choice", "L1", `["舍己为人","风和日丽","鸟语花香","水平如镜"]`, "舍己为人"},
		{"《蟋蟀的住宅》作者是____（国家）的____。", "fill", "L2", `[]`, "法国|法布尔"},
		{"《爬山虎的脚》作者是？", "choice", "L2", `["叶圣陶","巴金","老舍","冰心"]`, "叶圣陶"},
		{"观察一种植物，写写它的特点。", "essay", "L2", `[]`, "仙人掌浑身是刺，却能在干旱中顽强生长。"},
		{"下列拼音全对的是？", "choice", "L1", `["空隙(kòng xì)","弯曲(wān qǔ)","触角(chù jiǎo)","嫩红(nèn hóng)"]`, "嫩红"},
		{"《麻雀》中老麻雀用自己的____掩护小麻雀。", "fill", "L1", `[]`, "身体"},
		{"《为中华之崛起而读书》的主人公是？", "choice", "L3", `["周恩来","毛泽东","刘少奇","朱德"]`, "周恩来"},
		{"你为什么读书？写一段话。", "essay", "L2", `[]`, "我为增长见识、将来建设家乡而读书。"},
	}
	for i, q := range qdata {
		rec := repository.Question{
			TeacherID:       teacherID,
			SchoolID:        school.ID,
			Subject:         "语文",
			Grade:           "四年级",
			Content:         q.content,
			Type:            q.qtype,
			Difficulty:      q.diff,
			Options:         datatypes.JSON(q.options),
			Answer:          q.answer,
			AnswerDetail:    "参考答案：" + q.answer,
			Source:          "original",
			IsPublic:        true,
			AuditStatus:     "approved",
			KnowledgePoints: datatypes.JSON(`[]`),
			UsageCount:      i % 5,
			AvgRating:       4.2,
			CorrectRate:     0.78,
			AutoTags:        datatypes.JSON(`["语文","四年级"]`),
			CreatedAt:       now,
			UpdatedAt:       now,
		}
		must(db.Create(&rec).Error, "create question")
	}

	// ── 10. 试卷 3（语文/四年级，2 published + 1 draft）──
	examQuestions := `[{"stem":"《观潮》的作者是谁？","type":"choice","score":20},{"stem":"概括《观潮》主要内容","type":"essay","score":30}]`
	exams := []model.Exam{
		{ID: "exam-001", SchoolID: school.ID, TeacherID: teacherID, Title: "四年级语文第一单元测试", Subject: "语文", Grade: "四年级", Questions: examQuestions, TotalScore: 100, DurationMinutes: 60, Difficulty: "L2", Status: "published"},
		{ID: "exam-002", SchoolID: school.ID, TeacherID: teacherID, Title: "四年级语文期中模拟卷", Subject: "语文", Grade: "四年级", Questions: examQuestions, TotalScore: 100, DurationMinutes: 90, Difficulty: "L3", Status: "published"},
		{ID: "exam-003", SchoolID: school.ID, TeacherID: teacherID, Title: "四年级语文习作专项", Subject: "语文", Grade: "四年级", Questions: examQuestions, TotalScore: 50, DurationMinutes: 40, Difficulty: "L2", Status: "draft"},
	}
	for _, e := range exams {
		must(db.Create(&e).Error, "create exam")
	}

	// ── 11. 素材 8（挂在 13800000002，类型图标多样化）──
	materialTypes := []string{"ppt", "doc", "pdf", "image", "video", "audio", "link", "xlsx"}
	materialNames := []string{
		"《观潮》课件PPT", "桂花雨教学设计.doc", "单元测试卷.pdf", "钱塘江大潮实景图.png",
		"朗读示范视频.mp4", "课文音频.mp3", "拓展阅读链接", "成绩分析表.xlsx",
	}
	for i := 0; i < 8; i++ {
		m := model.Material{
			SchoolID:  school.ID,
			UserID:    teacherID,
			Name:      materialNames[i],
			Type:      materialTypes[i],
			Size:      fmt.Sprintf("%dKB", (i+1)*120),
			Tag:       "语文",
			URL:       fmt.Sprintf("https://cdn.ziwi.cn/materials/%s-%d", materialTypes[i], i+1),
			CreatedAt: now,
		}
		must(db.Create(&m).Error, "create material")
	}

	// ── 11b. 装饰元件公共库（P1）：平台公共装饰元件，user_id 留空表示平台所有。
	// facet 受控词表（平台运营维护），教师上传只能选受控标签，避免标签污染。
	// facet 4 维与前端 STYLE_LABELS / COLOR_FAMILIES 同源：applicable/motif/color/page_type。
	// 覆盖 8 风格（国风/素净/科技/清新/严谨/卡通/扁平/沉稳），每风格 2 个元件（角标+浮动点缀）。
	// 图片资源尚未上传，URL 用内联 SVG dataURL，保证前端 AI 推荐/装饰面板可直接渲染；
	// 待平台上传真实素材后，将 URL 替换为素材库地址即可。
	svgDecor := func(svg string) string {
		return "data:image/svg+xml;utf8," + url.QueryEscape(svg)
	}
	decorElements := []model.Material{
		// 国风：印章角标 + 竹枝
		{SchoolID: school.ID, UserID: "", Name: "国风印章", Type: "image", Format: "common", Tag: "装饰元件", Size: "1KB",
			URL: svgDecor(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect x="6" y="6" width="52" height="52" rx="8" fill="none" stroke="#B5121B" stroke-width="3"/><text x="32" y="42" font-size="28" text-anchor="middle" fill="#B5121B" font-family="serif">印</text></svg>`),
			Category: "decor_element", Applicable: "common", MotifRoot: "国风", ColorRoot: "红金系", PageType: "content",
			DecorFacets: model.DecorFacets{"motif.国风", "color.红金系", "page_type.content", "applicable.common"}},
		{SchoolID: school.ID, UserID: "", Name: "国风竹枝", Type: "image", Format: "common", Tag: "装饰元件", Size: "1KB",
			URL: svgDecor(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40" viewBox="0 0 80 40"><g stroke="#1E5631" stroke-width="2" fill="none"><path d="M12 40 Q14 20 10 4"/><path d="M12 14 Q22 16 20 6"/><path d="M12 24 Q20 22 22 30"/><path d="M28 40 Q30 22 26 8"/><path d="M28 18 Q36 20 34 10"/><path d="M28 26 Q36 24 38 32"/></g></svg>`),
			Category: "decor_element", Applicable: "common", MotifRoot: "国风", ColorRoot: "青绿系", PageType: "content",
			DecorFacets: model.DecorFacets{"motif.国风", "color.青绿系", "page_type.content", "applicable.common"}},
		// 素净：同心圆 + 圆点
		{SchoolID: school.ID, UserID: "", Name: "素净同心圆", Type: "image", Format: "common", Tag: "装饰元件", Size: "1KB",
			URL: svgDecor(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" fill="none" stroke="#9AA0A6" stroke-width="2"/><circle cx="32" cy="32" r="18" fill="none" stroke="#9AA0A6" stroke-width="1"/></svg>`),
			Category: "decor_element", Applicable: "common", MotifRoot: "素净", ColorRoot: "灰系", PageType: "content",
			DecorFacets: model.DecorFacets{"motif.素净", "color.灰系", "page_type.content", "applicable.common"}},
		{SchoolID: school.ID, UserID: "", Name: "素净圆点", Type: "image", Format: "common", Tag: "装饰元件", Size: "1KB",
			URL: svgDecor(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="5" fill="#C0C4C8"/></svg>`),
			Category: "decor_element", Applicable: "common", MotifRoot: "素净", ColorRoot: "灰系", PageType: "content",
			DecorFacets: model.DecorFacets{"motif.素净", "color.灰系", "page_type.content", "applicable.common"}},
		// 科技：六边形 + 网格
		{SchoolID: school.ID, UserID: "", Name: "科技六边形", Type: "image", Format: "common", Tag: "装饰元件", Size: "1KB",
			URL: svgDecor(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><polygon points="32,6 56,20 56,44 32,58 8,44 8,20" fill="none" stroke="#02A7F0" stroke-width="2.5"/><circle cx="32" cy="32" r="6" fill="#02A7F0"/></svg>`),
			Category: "decor_element", Applicable: "common", MotifRoot: "科技", ColorRoot: "蓝系", PageType: "content",
			DecorFacets: model.DecorFacets{"motif.科技", "color.蓝系", "page_type.content", "applicable.common"}},
		{SchoolID: school.ID, UserID: "", Name: "科技网格", Type: "image", Format: "common", Tag: "装饰元件", Size: "1KB",
			URL: svgDecor(`<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><g stroke="#7FB8E6" stroke-width="1" fill="none"><path d="M0 20 H60 M0 40 H60 M20 0 V60 M40 0 V60"/></g></svg>`),
			Category: "decor_element", Applicable: "common", MotifRoot: "科技", ColorRoot: "蓝系", PageType: "content",
			DecorFacets: model.DecorFacets{"motif.科技", "color.蓝系", "page_type.content", "applicable.common"}},
		// 清新：叶子 + 小叶
		{SchoolID: school.ID, UserID: "", Name: "清新叶子", Type: "image", Format: "common", Tag: "装饰元件", Size: "1KB",
			URL: svgDecor(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><path d="M32 56 C10 44 8 16 28 8 C52 2 58 30 32 56 Z" fill="#8FD3B6"/><path d="M28 12 C40 18 40 34 28 48" stroke="#1E5631" stroke-width="2" fill="none"/></svg>`),
			Category: "decor_element", Applicable: "common", MotifRoot: "清新", ColorRoot: "青绿系", PageType: "content",
			DecorFacets: model.DecorFacets{"motif.清新", "color.青绿系", "page_type.content", "applicable.common"}},
		{SchoolID: school.ID, UserID: "", Name: "清新小叶", Type: "image", Format: "common", Tag: "装饰元件", Size: "1KB",
			URL: svgDecor(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><path d="M20 36 C8 28 6 12 18 6 C32 2 36 22 20 36 Z" fill="#A8D8C0"/></svg>`),
			Category: "decor_element", Applicable: "common", MotifRoot: "清新", ColorRoot: "青绿系", PageType: "content",
			DecorFacets: model.DecorFacets{"motif.清新", "color.青绿系", "page_type.content", "applicable.common"}},
		// 严谨：斜线 + 横线
		{SchoolID: school.ID, UserID: "", Name: "严谨斜线", Type: "image", Format: "common", Tag: "装饰元件", Size: "1KB",
			URL: svgDecor(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><line x1="8" y1="56" x2="56" y2="8" stroke="#1F4E79" stroke-width="3"/><line x1="16" y1="56" x2="56" y2="16" stroke="#1F4E79" stroke-width="1.5"/><line x1="8" y1="48" x2="48" y2="8" stroke="#1F4E79" stroke-width="1.5"/></svg>`),
			Category: "decor_element", Applicable: "common", MotifRoot: "严谨", ColorRoot: "蓝系", PageType: "content",
			DecorFacets: model.DecorFacets{"motif.严谨", "color.蓝系", "page_type.content", "applicable.common"}},
		{SchoolID: school.ID, UserID: "", Name: "严谨横线", Type: "image", Format: "common", Tag: "装饰元件", Size: "1KB",
			URL: svgDecor(`<svg xmlns="http://www.w3.org/2000/svg" width="60" height="10" viewBox="0 0 60 10"><rect x="0" y="3" width="60" height="4" fill="#1F4E79"/></svg>`),
			Category: "decor_element", Applicable: "common", MotifRoot: "严谨", ColorRoot: "蓝系", PageType: "content",
			DecorFacets: model.DecorFacets{"motif.严谨", "color.蓝系", "page_type.content", "applicable.common"}},
		// 卡通：太阳 + 星星
		{SchoolID: school.ID, UserID: "", Name: "卡通太阳", Type: "image", Format: "common", Tag: "装饰元件", Size: "1KB",
			URL: svgDecor(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="16" fill="#FFB020"/><g stroke="#FFB020" stroke-width="3" stroke-linecap="round"><line x1="32" y1="6" x2="32" y2="14"/><line x1="32" y1="50" x2="32" y2="58"/><line x1="6" y1="32" x2="14" y2="32"/><line x1="50" y1="32" x2="58" y2="32"/><line x1="13" y1="13" x2="19" y2="19"/><line x1="45" y1="45" x2="51" y2="51"/><line x1="13" y1="51" x2="19" y2="45"/><line x1="45" y1="19" x2="51" y2="13"/></g></svg>`),
			Category: "decor_element", Applicable: "common", MotifRoot: "卡通", ColorRoot: "暖棕系", PageType: "content",
			DecorFacets: model.DecorFacets{"motif.卡通", "color.暖棕系", "page_type.content", "applicable.common"}},
		{SchoolID: school.ID, UserID: "", Name: "卡通星星", Type: "image", Format: "common", Tag: "装饰元件", Size: "1KB",
			URL: svgDecor(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><polygon points="20,4 24,15 36,15 26,22 30,34 20,27 10,34 14,22 4,15 16,15" fill="#FFC53D"/></svg>`),
			Category: "decor_element", Applicable: "common", MotifRoot: "卡通", ColorRoot: "暖棕系", PageType: "content",
			DecorFacets: model.DecorFacets{"motif.卡通", "color.暖棕系", "page_type.content", "applicable.common"}},
		// 卡通额外装饰（AI 推荐素材，让"一键应用"有可追加内容）
		{SchoolID: school.ID, UserID: "", Name: "卡通云朵", Type: "image", Format: "common", Tag: "装饰元件", Size: "1KB",
			URL: svgDecor(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40" viewBox="0 0 80 40"><g fill="#E8F4F8"><circle cx="20" cy="22" r="14"/><circle cx="36" cy="16" r="14"/><circle cx="54" cy="22" r="14"/><circle cx="42" cy="26" r="14"/><rect x="20" y="22" width="48" height="14"/></g></svg>`),
			Category: "decor_element", Applicable: "common", MotifRoot: "卡通", ColorRoot: "暖棕系", PageType: "content",
			DecorFacets: model.DecorFacets{"motif.卡通", "color.暖棕系", "page_type.content", "applicable.common"}},
		{SchoolID: school.ID, UserID: "", Name: "卡通彩虹", Type: "image", Format: "common", Tag: "装饰元件", Size: "1KB",
			URL: svgDecor(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40" viewBox="0 0 80 40"><path d="M10 38 A30 30 0 0 1 70 38" fill="none" stroke="#F5222D" stroke-width="4"/><path d="M16 38 A24 24 0 0 1 64 38" fill="none" stroke="#FAAD14" stroke-width="4"/><path d="M22 38 A18 18 0 0 1 58 38" fill="none" stroke="#52C41A" stroke-width="4"/></svg>`),
			Category: "decor_element", Applicable: "common", MotifRoot: "卡通", ColorRoot: "多彩渐变", PageType: "content",
			DecorFacets: model.DecorFacets{"motif.卡通", "color.多彩渐变", "page_type.content", "applicable.common"}},
		{SchoolID: school.ID, UserID: "", Name: "卡通爱心", Type: "image", Format: "common", Tag: "装饰元件", Size: "1KB",
			URL: svgDecor(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><path d="M20 34 C4 22 4 8 12 6 C16 4 19 7 20 10 C21 7 24 4 28 6 C36 8 36 22 20 34 Z" fill="#F5222D"/></svg>`),
			Category: "decor_element", Applicable: "common", MotifRoot: "卡通", ColorRoot: "暖棕系", PageType: "content",
			DecorFacets: model.DecorFacets{"motif.卡通", "color.暖棕系", "page_type.content", "applicable.common"}},
		// 科技额外装饰（让科技模板也能有 AI 推荐内容）
		{SchoolID: school.ID, UserID: "", Name: "科技电路", Type: "image", Format: "common", Tag: "装饰元件", Size: "1KB",
			URL: svgDecor(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40" viewBox="0 0 80 40"><g stroke="#02A7F0" stroke-width="2" fill="none"><path d="M0 20 H25"/><path d="M55 20 H80"/><path d="M40 4 V36"/><circle cx="40" cy="20" r="6"/><circle cx="40" cy="20" r="2" fill="#02A7F0"/></g></svg>`),
			Category: "decor_element", Applicable: "common", MotifRoot: "科技", ColorRoot: "蓝系", PageType: "content",
			DecorFacets: model.DecorFacets{"motif.科技", "color.蓝系", "page_type.content", "applicable.common"}},
		{SchoolID: school.ID, UserID: "", Name: "科技芯片", Type: "image", Format: "common", Tag: "装饰元件", Size: "1KB",
			URL: svgDecor(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect x="14" y="14" width="36" height="36" fill="none" stroke="#02A7F0" stroke-width="2.5"/><rect x="22" y="22" width="20" height="20" fill="#7FB8E6"/><g fill="#02A7F0"><rect x="10" y="20" width="4" height="4"/><rect x="10" y="30" width="4" height="4"/><rect x="10" y="40" width="4" height="4"/><rect x="50" y="20" width="4" height="4"/><rect x="50" y="30" width="4" height="4"/><rect x="50" y="40" width="4" height="4"/><rect x="20" y="10" width="4" height="4"/><rect x="30" y="10" width="4" height="4"/><rect x="40" y="10" width="4" height="4"/><rect x="20" y="50" width="4" height="4"/><rect x="30" y="50" width="4" height="4"/><rect x="40" y="50" width="4" height="4"/></g></svg>`),
			Category: "decor_element", Applicable: "common", MotifRoot: "科技", ColorRoot: "蓝系", PageType: "content",
			DecorFacets: model.DecorFacets{"motif.科技", "color.蓝系", "page_type.content", "applicable.common"}},
		// 扁平：双圆 + 圆点组
		{SchoolID: school.ID, UserID: "", Name: "扁平双圆", Type: "image", Format: "common", Tag: "装饰元件", Size: "1KB",
			URL: svgDecor(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="20" cy="44" r="14" fill="#E8EAF0"/><circle cx="44" cy="20" r="10" fill="#D0D5DD"/></svg>`),
			Category: "decor_element", Applicable: "common", MotifRoot: "扁平", ColorRoot: "灰系", PageType: "cover",
			DecorFacets: model.DecorFacets{"motif.扁平", "color.灰系", "page_type.cover", "applicable.common"}},
		{SchoolID: school.ID, UserID: "", Name: "扁平圆点组", Type: "image", Format: "common", Tag: "装饰元件", Size: "1KB",
			URL: svgDecor(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="12" cy="28" r="7" fill="#E8EAF0"/><circle cx="28" cy="12" r="5" fill="#C8CDD6"/></svg>`),
			Category: "decor_element", Applicable: "common", MotifRoot: "扁平", ColorRoot: "灰系", PageType: "content",
			DecorFacets: model.DecorFacets{"motif.扁平", "color.灰系", "page_type.content", "applicable.common"}},
		// 沉稳：边框 + 色块条
		{SchoolID: school.ID, UserID: "", Name: "沉稳边框", Type: "image", Format: "common", Tag: "装饰元件", Size: "1KB",
			URL: svgDecor(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect x="10" y="18" width="44" height="34" fill="none" stroke="#4A4A4A" stroke-width="2.5"/><line x1="10" y1="28" x2="54" y2="28" stroke="#4A4A4A" stroke-width="1.5"/></svg>`),
			Category: "decor_element", Applicable: "common", MotifRoot: "沉稳", ColorRoot: "黑白系", PageType: "content",
			DecorFacets: model.DecorFacets{"motif.沉稳", "color.黑白系", "page_type.content", "applicable.common"}},
		{SchoolID: school.ID, UserID: "", Name: "沉稳色块条", Type: "image", Format: "common", Tag: "装饰元件", Size: "1KB",
			URL: svgDecor(`<svg xmlns="http://www.w3.org/2000/svg" width="60" height="8" viewBox="0 0 60 8"><rect x="0" y="0" width="60" height="8" fill="#4A4A4A"/></svg>`),
			Category: "decor_element", Applicable: "common", MotifRoot: "沉稳", ColorRoot: "黑白系", PageType: "content",
			DecorFacets: model.DecorFacets{"motif.沉稳", "color.黑白系", "page_type.content", "applicable.common"}},
		// ── 套路级差异化装饰（内容充实新增成果，assetId 对齐前端 cwTemplate.ts SCENARIO_DECOR_MAP）──
		{SchoolID: school.ID, UserID: "", ID: "decor-china-brush", Name: "国风毛笔", Type: "image", Format: "common", Tag: "装饰元件", Size: "1KB",
			URL: svgDecor(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect x="10" y="6" width="44" height="9" rx="3" fill="#7A1F1F"/><path d="M28 15 L36 15 L33 50 Z" fill="#3A2A1A"/><path d="M31 50 Q33 60 35 50 Q33 55 31 50 Z" fill="#1C1C1C"/><circle cx="14" cy="54" r="3" fill="#1E5631"/></svg>`),
			Category: "decor_element", Applicable: "common", MotifRoot: "国风", ColorRoot: "红金系", PageType: "content",
			DecorFacets: model.DecorFacets{"motif.国风", "color.红金系", "page_type.content", "applicable.common"}},
		{SchoolID: school.ID, UserID: "", ID: "decor-china-cloud", Name: "国风卷云", Type: "image", Format: "common", Tag: "装饰元件", Size: "1KB",
			URL: svgDecor(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40" viewBox="0 0 80 40"><path d="M8 28 Q8 16 20 16 Q24 8 34 12 Q44 8 46 18 Q58 16 58 26 Q58 32 48 32 L16 32 Q8 32 8 28 Z" fill="none" stroke="#B5121B" stroke-width="2"/></svg>`),
			Category: "decor_element", Applicable: "common", MotifRoot: "国风", ColorRoot: "红金系", PageType: "content",
			DecorFacets: model.DecorFacets{"motif.国风", "color.红金系", "page_type.content", "applicable.common"}},
		{SchoolID: school.ID, UserID: "", ID: "decor-kinder-bear", Name: "卡通小熊", Type: "image", Format: "common", Tag: "装饰元件", Size: "1KB",
			URL: svgDecor(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="34" r="20" fill="#F4A261"/><circle cx="22" cy="18" r="6" fill="#F4A261"/><circle cx="42" cy="18" r="6" fill="#F4A261"/><circle cx="25" cy="32" r="3" fill="#3A2A1A"/><circle cx="39" cy="32" r="3" fill="#3A2A1A"/><ellipse cx="32" cy="40" rx="5" ry="4" fill="#3A2A1A"/></svg>`),
			Category: "decor_element", Applicable: "common", MotifRoot: "卡通", ColorRoot: "暖棕系", PageType: "content",
			DecorFacets: model.DecorFacets{"motif.卡通", "color.暖棕系", "page_type.content", "applicable.common"}},
		{SchoolID: school.ID, UserID: "", ID: "decor-kinder-balloon", Name: "卡通气球", Type: "image", Format: "common", Tag: "装饰元件", Size: "1KB",
			URL: svgDecor(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48"><ellipse cx="20" cy="16" rx="13" ry="15" fill="#FF6B9D"/><path d="M20 31 L20 40" stroke="#FF6B9D" stroke-width="1.5"/><path d="M16 40 L24 40 L20 45 Z" fill="#FF6B9D"/></svg>`),
			Category: "decor_element", Applicable: "common", MotifRoot: "卡通", ColorRoot: "暖棕系", PageType: "content",
			DecorFacets: model.DecorFacets{"motif.卡通", "color.暖棕系", "page_type.content", "applicable.common"}},
	}
	// 对齐前端 cwTemplate.ts STYLE_DECOR_MAP / SCENARIO_DECOR_MAP 的 assetId，
	// 使模板 DecorSlot.assetId 能精确命中素材库元件（前端 resolveDecorUrl 按 assetId 取真实 URL）
	decorNameToID := map[string]string{
		"国风印章": "decor-china-seal", "国风竹枝": "decor-china-bamboo",
		"素净同心圆": "decor-minimal-line", "素净圆点": "decor-minimal-dot",
		"科技六边形": "decor-tech-hex", "科技网格": "decor-tech-grid",
		"清新叶子": "decor-fresh-leaf", "清新小叶": "decor-fresh-leaf-sm",
		"严谨斜线": "decor-aca-rule", "严谨横线": "decor-aca-line",
		"卡通太阳": "decor-cartoon-sun", "卡通星星": "decor-cartoon-star",
		"卡通云朵": "decor-cartoon-cloud", "卡通彩虹": "decor-cartoon-rainbow", "卡通爱心": "decor-cartoon-heart",
		"科技电路": "decor-tech-circuit", "科技芯片": "decor-tech-chip",
		"扁平双圆": "decor-flat-circle", "扁平圆点组": "decor-flat-dot",
		"沉稳边框": "decor-biz-line", "沉稳色块条": "decor-biz-bar",
		"通用角标": "decor-basic-corner", "通用圆点": "decor-basic-dot",
	}
	for i := range decorElements {
		if id, ok := decorNameToID[decorElements[i].Name]; ok {
			decorElements[i].ID = id
		}
	}
	// 幂等 + 历史 id 迁移：装饰现已用稳定 assetId 作主键（对齐前端 DecorSlot.assetId）。
	// 旧库里同名装饰可能是自动 uuid，这里按 name 找到后把 id 一并纠正为 assetId，并刷新全部内容字段，
	// 避免"前端按 assetId 查不到 → 全回落内联 SVG 兜底"的后患。找不到才 Create。
	for i := range decorElements {
		var existing model.Material
		err := db.Where("name = ? AND category = ?", decorElements[i].Name, decorElements[i].Category).First(&existing).Error
		if err == nil {
			must(db.Model(&existing).Updates(map[string]interface{}{
				"id": decorElements[i].ID, "url": decorElements[i].URL, "name": decorElements[i].Name,
				"motif_root": decorElements[i].MotifRoot, "color_root": decorElements[i].ColorRoot,
				"page_type": decorElements[i].PageType, "applicable": decorElements[i].Applicable,
				"decor_facets": decorElements[i].DecorFacets,
			}).Error, "migrate+update decor element")
			continue
		}
		must(db.Create(&decorElements[i]).Error, "create decor element")
	}
	fmt.Println("装饰元件公共库种子: 已同步", len(decorElements), "个")

	// ── 11c. facet 受控词表（平台运营维护母题/媒介等词库）。
	// 教师上传装饰元件 / 筛选只能选受控标签，避免标签污染。
	// facet 4 维与前端 cwTemplate.ts 的 STYLE_LABELS / COLOR_FAMILIES 同源：
	// motif(母题=风格) / color(色系) / medium(媒介) / page_type(页型)。
	facetSeed := []model.FacetVocab{
		{Type: "motif", Value: "国风", Label: "国风", Sort: 1},
		{Type: "motif", Value: "素净", Label: "素净", Sort: 2},
		{Type: "motif", Value: "科技", Label: "科技", Sort: 3},
		{Type: "motif", Value: "清新", Label: "清新", Sort: 4},
		{Type: "motif", Value: "严谨", Label: "严谨", Sort: 5},
		{Type: "motif", Value: "卡通", Label: "卡通", Sort: 6},
		{Type: "motif", Value: "扁平", Label: "扁平", Sort: 7},
		{Type: "motif", Value: "沉稳", Label: "沉稳", Sort: 8},
		{Type: "medium", Value: "ppt", Label: "PPT", Sort: 1},
		{Type: "medium", Value: "h5", Label: "H5", Sort: 2},
		{Type: "medium", Value: "common", Label: "通用", Sort: 3},
		{Type: "color", Value: "蓝系", Label: "蓝系", Sort: 1},
		{Type: "color", Value: "青绿系", Label: "青绿系", Sort: 2},
		{Type: "color", Value: "红金系", Label: "红金系", Sort: 3},
		{Type: "color", Value: "暖棕系", Label: "暖棕系", Sort: 4},
		{Type: "color", Value: "紫粉系", Label: "紫粉系", Sort: 5},
		{Type: "color", Value: "灰系", Label: "灰系", Sort: 6},
		{Type: "color", Value: "黑白系", Label: "黑白系", Sort: 7},
		{Type: "color", Value: "多彩渐变", Label: "多彩渐变", Sort: 8},
		{Type: "page_type", Value: "cover", Label: "封面", Sort: 1},
		{Type: "page_type", Value: "content", Label: "内容页", Sort: 2},
		{Type: "page_type", Value: "summary", Label: "小结页", Sort: 3},
		{Type: "page_type", Value: "homework", Label: "作业页", Sort: 4},
	}
	for i := range facetSeed {
		// 幂等: 以 type+value 为主键语义（UpsertFacet 用 id=type-value）
		facetSeed[i].ID = "fv-" + facetSeed[i].Type + "-" + facetSeed[i].Value
		must(db.Where("id = ?", facetSeed[i].ID).FirstOrCreate(&facetSeed[i]).Error, "create facet "+facetSeed[i].ID)
	}
	fmt.Println("facet 受控词表种子: 已插入", len(facetSeed), "个")

	// ── 12. 作业 4（语文/四年级，挂在 c-001）──
	assignQuestions := `[{"q":"《观潮》作者是谁？","type":"choice","score":10},{"q":"概括主要内容","type":"essay","score":20}]`
	for i := 1; i <= 4; i++ {
		a := repository.Assignment{
			ID:             fmt.Sprintf("asg-%03d", i),
			TeacherID:      teacherID,
			SchoolID:       school.ID,
			ClassID:        "c-001",
			Subject:        "语文",
			Title:          fmt.Sprintf("第%d次语文作业", i),
			AssignmentType: "regular",
			Questions:      assignQuestions,
			TotalScore:     30,
			DueType:        "relative",
			DueHours:       48,
			DueAt:          nil,
			PublishedAt:    &now,
			GradingStatus:  "pending",
			CreatedAt:      now,
			UpdatedAt:      now,
		}
		must(db.Create(&a).Error, "create assignment")
	}

	// ── 12b. 课件（CoursewareList 读 materials 表 type='courseware'；前端按 format 分 PPT/H5/视频频道）──
	// 之前种子脚本缺此段，staging 课件列表为空。content 为 markdown，供 CoursewareBuilder 打开解析。
	// 每个课件完整采用一个明确风格（theme_id 指向 pptThemes.ts 中的具体主题），
	// content 用结构化教学版式 markdown（封面/目标/讲解/例题/小结/作业），
	// 打开 CoursewareBuilder 即呈现对应风格的完整课件。
	// 每个课件完整采用一个明确风格（theme_id 指向 pptThemes.ts 中的具体主题）。
	// content 为教学版式 markdown：
	//   - 不额外写封面（CoursewareBuilder 用 material.name 自动渲染封面）
	//   - <!-- layout: xxx --> 紧跟在 ## 标题下一行（解析器写入当前页）
	// 共 10~11 个内容页，足以撑起 40 分钟课时。
	coursewares := []model.Material{
		{
			// 风格：国风 · 山水青绿（zgf-shanshui）
			ID: "cw-ppt-001", SchoolID: school.ID, UserID: teacherID,
			Name: "《观潮》PPT课件", Type: "courseware", Format: "ppt", Size: "1.6MB", Tag: "语文",
			ThemeID: "zgf-shanshui",
			Content: `## 课前导入
同学们，你们见过大海涨潮吗？今天我们要去浙江海宁，看看被誉为“天下奇观”的钱塘江大潮。

## 教学目标
<!-- layout: edu-goal -->
- 知识与技能：会写“罩、贯、恢”等生字，有感情朗读课文
- 过程与方法：按“潮来前—潮来时—潮头过后”顺序梳理文章结构
- 情感态度：感受大潮的壮观，激发对祖国河山的热爱之情

## 作者与背景
<!-- layout: edu-explain -->
- 作者：赵宗成、朱明元，现代作家
- 写作背景：描写的是农历八月十八钱塘江观潮的盛况
- 文体：写景散文，以时间为线索

## 重点字词
<!-- layout: edu-explain -->
- 笼罩：像笼子一样罩住，形容雾气弥漫
- 横贯：横向贯穿，写出潮水范围之广
- 人声鼎沸：人群声音像水在锅里沸腾，形容热闹
- 山崩地裂：形容潮水声响巨大

## 课文精读 · 潮来前
<!-- layout: edu-explain -->
- 景象：江面平静，薄雾笼罩，人群昂首东望
- 作用：以静衬动，为下文大潮蓄势
- 关键词：蒙蒙的薄雾、人山人海、等着、盼着

## 课文精读 · 潮来时
<!-- layout: edu-explain -->
- 声音：从远处传来隆隆的响声，好像闷雷滚动
- 形态：一条白线 → 白浪翻滚 → 千万匹白色战马齐头并进
- 气势：浩浩荡荡，飞奔而来

## 写作手法赏析
<!-- layout: edu-explain -->
- 顺序：时间顺序，条理清晰
- 修辞：比喻、夸张，突出大潮气势
- 动静结合：潮来前的静与潮来时的动形成对比

## 例题演练
<!-- layout: edu-example -->
- 题干：读“浪潮越来越近，犹如千万匹白色战马齐头并进”，说说这样写的好处
- 分析：运用比喻修辞，把浪潮比作战马
- 解答：生动形象地写出潮水逼近时气势磅礴、势不可挡的样子
- 迁移：你还能找出文中哪些比喻句？

## 互动思考
<!-- layout: edu-example -->
- 问题：为什么作者要详写潮来时，略写潮来前和潮头过后？
- 小组讨论：这样安排详略有什么好处？
- 结论：突出重点，让读者感受最壮观的时刻

## 课堂小结
<!-- layout: edu-summary -->
- 内容：按时间顺序描写钱塘江大潮
- 写法：动静结合、比喻夸张、详略得当
- 情感：赞美自然奇观，抒发热爱祖国河山之情

## 作业布置
<!-- layout: edu-homework -->
- 基础：抄写本课生字词各两遍，有感情朗读课文
- 提高：摘抄文中描写潮水的3个精彩句子并批注
- 拓展：搜集一首描写江河湖海的古诗词，下节课分享`,
			Status: "active", Grade: "四年级", Subject: "语文", Category: "courseware",
		},
		{
			// 风格：清新 · 薄荷绿（fr-mint）
			ID: "cw-h5-001", SchoolID: school.ID, UserID: teacherID,
			Name: "《桂花雨》H5互动课件", Type: "courseware", Format: "h5", Tag: "语文",
			ThemeID: "fr-mint",
			Content: `## 课前导入
<!-- layout: edu-explain -->
- 闻一闻：桂花是什么香味？
- 想一想：一种花的香味，能让你想起故乡吗？
- 说一说：你印象最深的一种家乡味道

## 教学目标
<!-- layout: edu-goal -->
- 知识与技能：正确读写“箩、杭”等生字，理解“姿态、浸”等词语
- 过程与方法：抓住重点句段，体会作者借桂花表达的情感
- 情感态度：感悟作者思念家乡、怀念童年的思想感情

## 作者简介
<!-- layout: edu-explain -->
- 作者：琦君，台湾著名女作家
- 代表作：《橘子红了》《桂花雨》等
- 文风：温婉细腻，常借故乡风物抒发乡愁

## 重点字词
<!-- layout: edu-explain -->
- 姿态：姿势、样子
- 浸：泡在液体里，文中指桂花香弥漫
- 尤其：特别、格外
- 缠：纠缠、请求

## 课文精读 · 摇花乐
<!-- layout: edu-explain -->
- 场景：小时候摇桂花，满头满身都是桂花
- 感受：快乐、兴奋、香甜
- 情感：这是童年最难忘的记忆之一

## 课文精读 · 故乡情
<!-- layout: edu-explain -->
- 关键句：这里的桂花再香，也比不上家乡院子里的桂花
- 表面：比较两地桂花的香味
- 深层：借桂花抒发对故乡和母亲的思念

## 互动探究
<!-- layout: edu-example -->
- 问题：作者为什么写“这里的桂花再香，也比不上家乡院子里的桂花”？
- 选项：A. 家乡桂花品种更好 B. 寄托对故乡的思念 C. 只是随口说说
- 解析：选 B，表面写桂花，实则抒发对故乡、对童年的深切怀念
- 延伸：你还知道哪些借物抒情的诗句？

## 写法总结
<!-- layout: edu-explain -->
- 借物抒情：借桂花寄托思乡之情
- 以小见大：从摇桂花这件小事，写出深厚的情感
- 对比：故乡桂花与杭州桂花对比，突出乡愁

## 课堂小结
<!-- layout: edu-summary -->
- 主线：桂花香 → 摇花乐 → 思故乡
- 写法：借物抒情、以小见大
- 情感：一缕桂花香，浓浓故乡情

## 作业布置
<!-- layout: edu-homework -->
- 基础：有感情地朗读课文，抄写喜欢的句子
- 提高：写一段话，借一种事物表达对亲人或故乡的情感
- 拓展：读琦君其他作品，体会其乡愁主题`,
			Status: "active", Grade: "四年级", Subject: "语文", Category: "courseware",
		},
		{
			// 风格：科技 · 蓝紫极光渐变（gr-aurora），视频课件
			ID: "cw-video-001", SchoolID: school.ID, UserID: teacherID,
			Name: "《普罗米修斯》微课视频", Type: "courseware", Format: "video", Size: "38MB", Tag: "语文",
			ThemeID: "gr-aurora",
			URL:     "https://example.com/lesson/prometheus.mp4",
			Content: `## 课前导入
<!-- layout: edu-explain -->
- 问题：火对人类有多重要？
- 讨论：如果没有火，人类的生活会怎样？
- 过渡：是谁为人类带来了火？

## 教学目标
<!-- layout: edu-goal -->
- 知识与技能：认识“斯、惨”等生字，概括课文主要内容
- 过程与方法：抓住人物言行，体会神话人物形象
- 情感态度：感受普罗米修斯造福人类、不畏强暴的伟大精神

## 神话知识
<!-- layout: edu-explain -->
- 概念：神话是远古先民对自然现象和英雄的想象性解释
- 特点：充满想象，歌颂英雄，反映人类愿望
- 代表：希腊神话、中国古代神话、北欧神话

## 故事脉络
<!-- layout: edu-explain -->
- 起因：人类没有火，生活困苦
- 经过：普罗米修斯“盗”取天火送给人类
- 高潮：宙斯惩罚普罗米修斯，锁在高加索山
- 结局：赫拉克勒斯解救普罗米修斯

## 人物形象分析
<!-- layout: edu-explain -->
- 普罗米修斯：勇敢、善良、不屈不挠
- 宙斯：专横、残酷
- 赫拉克勒斯：正义、有力量
- 人类：感恩、敬仰英雄

## 例题演练
<!-- layout: edu-example -->
- 题干：普罗米修斯为什么宁愿受罚也要把火送给人类？
- 分析：体现了他对人类的爱和不畏强权的精神
- 解答：因为他同情人类，希望人类过上温暖、文明的生活
- 拓展：你认为他后悔吗？为什么？

## 中外神话比较
<!-- layout: edu-example -->
- 中国：燧人氏钻木取火
- 希腊：普罗米修斯盗火
- 共同点：都体现了人类对火的渴望和对英雄的崇敬
- 不同点：中国文化强调人的智慧和创造

## 课堂小结
<!-- layout: edu-summary -->
- 形象：普罗米修斯是“人类的恩主”，象征反抗与献身
- 主题：赞美不畏强暴、造福人类的英雄精神
- 拓展：中外神话中都有“盗火/取火”母题

## 作业布置
<!-- layout: edu-homework -->
- 基础：用自己的话复述故事
- 提高：画出故事发展的起因、经过、结果
- 拓展：比较中外神话中“取火”形象的异同`,
			Status:  "active", Grade: "四年级", Subject: "语文", Category: "courseware",
		},
		{
			// 风格：严谨 · 教研蓝（aca-edu-blue），数学
			ID: "cw-ppt-002", SchoolID: school.ID, UserID: teacherID,
			Name: "《小数乘法》PPT课件", Type: "courseware", Format: "ppt", Size: "1.3MB", Tag: "数学",
			ThemeID: "aca-edu-blue",
			Content: `## 课前导入
<!-- layout: edu-example -->
- 情境：一个风筝 6.5 元，买 3 个要多少钱？
- 列式：6.5 × 3
- 思考：这个算式和我们学过的整数乘法有什么不同？

## 教学目标
<!-- layout: edu-goal -->
- 知识与技能：理解小数乘整数的算理，掌握计算方法
- 过程与方法：经历探究过程，能正确进行笔算并验算
- 情感态度：在解决实际问题中体会数学与生活的联系

## 小数乘整数
<!-- layout: edu-explain -->
- 算理：先把小数看作整数来算
- 例：0.72 × 5
- 步骤：先算 72 × 5 = 360
- 再看因数有两位小数，从 360 右边数两位点小数点：3.60
- 化简：3.6

## 小数乘小数
<!-- layout: edu-explain -->
- 法则：先按整数乘法算出积
- 看因数一共有几位小数
- 从积的右边起数出几位，点上小数点
- 例：2.4 × 0.8 = 1.92

## 积的小数位数
<!-- layout: edu-explain -->
- 规则：积的小数位数等于因数小数位数之和
- 例：0.25 × 0.4，因数共三位小数
- 25 × 4 = 100，从右边数三位 → 0.100
- 末尾的 0 可以去掉，得 0.1

## 例题演练 1
<!-- layout: edu-example -->
- 题干：计算 2.4 × 0.8
- 思路：24 × 8 = 192，因数共两位小数
- 解答：从 192 右边数两位 → 1.92
- 验算：1.92 ÷ 0.8 = 2.4

## 例题演练 2
<!-- layout: edu-example -->
- 题干：计算 0.25 × 0.4
- 思路：25 × 4 = 100，因数共三位小数
- 解答：100 从右数三位 → 0.100 → 0.1
- 易错点：位数不够时要用 0 补足

## 生活应用
<!-- layout: edu-example -->
- 问题：苹果 5.8 元/千克，买了 2.5 千克，应付多少钱？
- 列式：5.8 × 2.5
- 计算：58 × 25 = 1450，因数共两位小数 → 14.50
- 答：应付 14.5 元

## 课堂小结
<!-- layout: edu-summary -->
- 步骤口诀：一看（因数小数位）二算（整数乘法）三点（点小数点）
- 易错：忘记点小数点、位数不够未补 0
- 应用：购物计价、长度面积计算都常用

## 作业布置
<!-- layout: edu-homework -->
- 基础：完成练习册第1、2题
- 提高：计算 0.25 × 0.4 并验算
- 拓展：思考“积与因数大小关系”的规律`,
			Status: "draft", Grade: "五年级", Subject: "数学", Category: "courseware",
		},
		{
			// 风格：卡通插画（sp-cartoon），语文低段
			ID: "cw-ppt-003", SchoolID: school.ID, UserID: teacherID,
			Name: "《小蝌蚪找妈妈》PPT课件", Type: "courseware", Format: "ppt", Size: "2.1MB", Tag: "语文",
			ThemeID: "sp-cartoon",
			Content: `## 课前导入
<!-- layout: edu-explain -->
- 猜谜语：黑脑袋，长尾巴，水里生，水里长，长大没尾巴
- 谜底：青蛙
- 过渡：小蝌蚪是怎么找到妈妈的？

## 教学目标
<!-- layout: edu-goal -->
- 知识与技能：借助图画读通课文，认识“塘、脑”等生字
- 过程与方法：了解小蝌蚪变成青蛙的生长过程
- 情感态度：喜欢阅读童话，乐于表达与分享

## 重点字词
<!-- layout: edu-explain -->
- 池塘：蓄水的坑洼，这里指小蝌蚪生活的地方
- 脑袋：头
- 甩：摆动
- 迎上去：面对面走过去

## 故事开端
<!-- layout: edu-explain -->
- 人物：一群小蝌蚪
- 样子：大大的脑袋，黑灰色的身子，甩着长长的尾巴
- 任务：去找妈妈

## 寻找过程
<!-- layout: edu-explain -->
- 第一次：问鲤鱼阿姨，不是妈妈
- 第二次：问乌龟，不是妈妈
- 第三次：看见白鹅，不是妈妈
- 第四次：终于找到青蛙妈妈

## 生长变化
<!-- layout: edu-explain -->
- 先长后腿
- 再长前腿
- 尾巴变短
- 最后变成小青蛙

## 互动问答
<!-- layout: edu-example -->
- 问题：小蝌蚪最后找到了谁？
- 选项：A. 鲤鱼 B. 乌龟 C. 青蛙
- 解析：选 C，小蝌蚪长大后就是青蛙妈妈的样子
- 思考：为什么小蝌蚪会认错妈妈？

## 角色扮演
<!-- layout: edu-example -->
- 角色：小蝌蚪、鲤鱼阿姨、乌龟、白鹅、青蛙妈妈
- 任务：分角色朗读对话
- 重点：读出疑问和高兴的语气

## 课堂小结
<!-- layout: edu-summary -->
- 变化：大脑袋 → 长后腿 → 长前腿 → 尾巴变短 → 青蛙
- 道理：小蝌蚪长成青蛙，是自然界的奇妙变化
- 启示：青蛙是益虫，我们要保护它

## 作业布置
<!-- layout: edu-homework -->
- 基础：把故事讲给家人听
- 提高：画一画小蝌蚪变成青蛙的过程
- 拓展：观察一种小动物的成长变化`,
			Status: "active", Grade: "二年级", Subject: "语文", Category: "courseware",
		},
		{
			// 风格：自然生机 · 森林绿（na-forest），科学
			ID: "cw-ppt-004", SchoolID: school.ID, UserID: teacherID,
			Name: "《植物的生长》PPT课件", Type: "courseware", Format: "ppt", Size: "2.0MB", Tag: "科学",
			ThemeID: "na-forest",
			Content: `## 课前导入
<!-- layout: edu-explain -->
- 猜一猜：一颗绿豆放进土里会发生什么？
- 想一想：植物生长需要什么？
- 说一说：你种过植物吗？

## 教学目标
<!-- layout: edu-goal -->
- 知识与技能：知道种子萌发需要水、空气和适宜温度
- 过程与方法：持续观察并记录植物的生长变化
- 情感态度：养成认真观察、实事求是的科学态度

## 种子萌发
<!-- layout: edu-explain -->
- 条件一：适量的水分
- 条件二：充足的空气
- 条件三：适宜的温度
- 过程：种子吸水膨胀 → 胚根突破种皮 → 胚芽生长

## 植物器官
<!-- layout: edu-explain -->
- 根：吸收水分和矿物质
- 茎：运输水分和养分
- 叶：进行光合作用
- 花、果实、种子：繁殖后代

## 光合作用
<!-- layout: edu-explain -->
- 概念：植物用阳光把水和二氧化碳变成养分
- 原料：二氧化碳 + 水
- 条件：阳光
- 产物：养分（淀粉）+ 氧气
- 意义：为植物提供生长能量

## 探究实验
<!-- layout: edu-example -->
- 问题：两盆豆苗，一盆放黑暗处、一盆放阳光下，几天后哪盆更绿？
- 假设：阳光下的豆苗更绿
- 步骤：每天对比观察叶片颜色并记录
- 结论：阳光下更绿，说明光对植物生长十分重要

## 生长过程
<!-- layout: edu-explain -->
- 顺序：种子 → 发芽 → 长叶 → 开花 → 结果
- 特点：是一个连续的生命过程
- 影响因素：光、水、空气、温度、土壤

## 环境影响
<!-- layout: edu-example -->
- 缺水：植物枯萎
- 缺光：叶片发黄
- 缺空气：根部腐烂
- 适宜环境：植物健康生长

## 课堂小结
<!-- layout: edu-summary -->
- 三要素：光、水、空气，缺一不可
- 全过程：种子 → 发芽 → 长叶 → 开花 → 结果
- 启示：生命离不开适宜的环境

## 作业布置
<!-- layout: edu-homework -->
- 基础：种一颗绿豆，每天记录它的高度
- 提高：画出植物生长的过程图
- 拓展：查资料了解光合作用公式`,
			Status: "active", Grade: "三年级", Subject: "科学", Category: "courseware",
		},
	}

	for i := range coursewares {
		coursewares[i].CreatedAt = now
		coursewares[i].UpdatedAt = now
		must(db.Create(&coursewares[i]).Error, "create courseware "+coursewares[i].ID)
	}
	fmt.Println("课件种子: 已插入", len(coursewares), "个")

	// ── 13. 成长关爱 7（teacher_id=13800000002，student_id 取前7名学生）──
	careStatuses := []string{
		"需要重点关注", "稳步提升", "情绪需疏导", "学习习惯待加强",
		"社交能力突出", "学业进步明显", "需家校协同",
	}
	for i := 0; i < 7; i++ {
		sid := fmt.Sprintf("s-%04d", i+1)
		plan, _ := json.Marshal(map[string]interface{}{
			"week": i + 1, "progress": (i + 1) * 10, "goal": "本周关注点跟进",
		})
		db.Exec(`INSERT INTO growth_care_records
			(student_id, teacher_id, school_id, current_status, teacher_observation, weekly_plan, plan_status)
			VALUES (?, ?, ?, ?, ?, ?, 'draft')`,
			sid, teacherID, school.ID, careStatuses[i], "课堂观察记录"+fmt.Sprintf("%d", i+1), string(plan))
	}

	// ── 14. 家长签字 3（引用 asg-001 与前3名学生）──
	for i := 1; i <= 3; i++ {
		sid := fmt.Sprintf("s-%04d", i)
		pid := fmt.Sprintf("p-%d", (i-1)%2+1)
		db.Exec(`INSERT INTO parent_signatures (parent_id, student_id, assignment_id)
			VALUES (?, ?, 'asg-001')`, pid, sid)
	}

	// ── 15. 学生提交 + 批阅 3（演示批改闭环）──
	for i := 1; i <= 3; i++ {
		sid := fmt.Sprintf("s-%04d", i)
		res := db.Exec(`INSERT INTO submissions (assignment_id, student_id, answers)
			VALUES ('asg-001', ?, '{"q1":"叶圣陶","q2":"概括正确"}') RETURNING id`, sid)
		if res.Error != nil {
			log.Printf("submission insert warn: %v", res.Error)
			continue
		}
		var subID string
		db.Raw("SELECT id FROM submissions WHERE assignment_id='asg-001' AND student_id=? ORDER BY submitted_at DESC LIMIT 1", sid).Scan(&subID)
		if subID != "" {
			db.Exec(`INSERT INTO grading_results (submission_id, question_id, ai_score, ai_confidence, status)
				VALUES (?, NULL, 28, 0.95, 'ai_graded')`, subID)
		}
	}

	fmt.Println("\n=== 增强版种子数据完成 ===")
	fmt.Println("学校: 树人实验小学 (sch-0001)")
	fmt.Println("教案 4 / 题目 24 / 试卷 3 / 素材 8 / 成长关爱 7 / 作业 4 / 课件素材 6")
	fmt.Println("\n=== 演示账号（QA专用）===")
	fmt.Println("13800000002 / teacher123  - 李老师 (teacher, 语文, 主力测试)")
	fmt.Println("13800000005 / teacher123  - 赵校长 (principal)")
	fmt.Println("13800000001 / admin123    - 赵管理员 (it_admin)")
	fmt.Println("13800000003 / teacher123  - 王老师 (teacher, 数学)")
	fmt.Println("13800000004 / teacher123  - 陈老师 (teacher, 英语)")
	fmt.Println("13800000006 / teacher123  - 周班主任 (head_teacher)")
	fmt.Println("13800000007 / teacher123  - 刘教务 (registrar)")
	fmt.Println("13800000008 / teacher123  - 李教研 (research_lead)")
	fmt.Println("学生 13901010001~13901010015 / student123")
	fmt.Println("家长 13902010001~13902010002 / parent123")
	fmt.Println("\nSeed OK!")
}

func ptr(s string) *string { return &s }
