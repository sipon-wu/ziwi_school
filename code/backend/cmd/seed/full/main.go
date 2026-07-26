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
	"os"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/datatypes"
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
		&model.School{}, &model.User{}, &model.Class{},
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
		ShortName: "树人实验",
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
	for i := 1; i <= 15; i++ {
		id := fmt.Sprintf("s-%04d", i)
		phone := fmt.Sprintf("1390101%03d", i)
		hash, _ := bcrypt.GenerateFromPassword([]byte("student123"), bcrypt.DefaultCost)
		user := model.User{
			ID:           id,
			SchoolID:     &school.ID,
			Phone:        phone,
			PasswordHash: string(hash),
			Role:         "student",
			Name:         fmt.Sprintf("学生%02d", i),
			StyleProfile: "{}",
			Status:       "active",
		}
		must(db.Create(&user).Error, "create student "+id)
	}

	// 家长（2 名，用于签字）
	for i, p := range []string{"13902010001", "13902010002"} {
		hash, _ := bcrypt.GenerateFromPassword([]byte("parent123"), bcrypt.DefaultCost)
		user := model.User{
			ID:           fmt.Sprintf("p-%d", i+1),
			SchoolID:     &school.ID,
			Phone:        p,
			PasswordHash: string(hash),
			Role:         "parent",
			Name:         fmt.Sprintf("家长%d", i+1),
			StyleProfile: "{}",
			Status:       "active",
		}
		must(db.Create(&user).Error, "create parent")
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
			KnowledgeNodes: `["kn-1","kn-2"]`,
			CurriculumAlign: `[{"code":"3.2.1","content":"联系上下文理解词句","aligned":true}]`,
			AIGenerated: true, AIModelVersion: "qwen-plus", GenerationTimeMs: 1200, EditCount: 2,
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
			TeacherID:      teacherID,
			SchoolID:       school.ID,
			Subject:        "语文",
			Grade:          "四年级",
			Content:        q.content,
			Type:           q.qtype,
			Difficulty:     q.diff,
			Options:        datatypes.JSON(q.options),
			Answer:         q.answer,
			AnswerDetail:   "参考答案：" + q.answer,
			Source:         "original",
			IsPublic:       true,
			AuditStatus:    "approved",
			KnowledgePoints: datatypes.JSON(`[]`),
			UsageCount:     i % 5,
			AvgRating:      4.2,
			CorrectRate:    0.78,
			AutoTags:       datatypes.JSON(`["语文","四年级"]`),
			CreatedAt:      now,
			UpdatedAt:      now,
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
	fmt.Println("教案 4 / 题目 24 / 试卷 3 / 素材 8 / 成长关爱 7 / 作业 4")
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
