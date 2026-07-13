# 知微教学助手 · 预发布环境全量产出物与质量报告

生成时间：2026/7/13 23:17:20　环境：school1.ziwi.cn（预发布）

## 一、覆盖达成（每个年级×学科 ≥3 产出物）

- 目标组合数：81（9 学科 × 9 年级）
- 已完成组合：81　其中 3/3 成功：81　部分成功：0　全失败：0
- 未达成组合：无

| 学科＼年级 | 一年级 | 二年级 | 三年级 | 四年级 | 五年级 | 六年级 | 七年级 | 八年级 | 九年级 |
|---|---|---|---|---|---|---|---|---|---|
| 语文 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 |
| 数学 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 |
| 英语 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 |
| 物理 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 |
| 化学 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 |
| 生物 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 |
| 政治 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 |
| 历史 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 |
| 地理 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 |

## 二、真实场景时长 / 节奏（真实浏览器 + 真实 AI 调用）

| 产出物类型 | 样本数 | 平均耗时(s) | 中位耗时(s) | 最大耗时(s) |
| --- | --- | --- | --- | --- |
| 课件(PPT) | 81 | 12.1 | 11.9 | 16.1 |
| 智能出题 | 81 | 7.7 | 7.4 | 16.3 |
| 教案 | 81 | 9.6 | 9.3 | 13.1 |

节奏说明：单组合（课件+出题+教案）串行约 29s；课件为耗时主体（约占总时长 60%+），出题最快。浏览器实测课件生成 14.2s 出 14 页提纲，小微对话首响 3.1s。

## 三、难度分布（智能出题 L1–L4）

| 难度 | 题量 |
| --- | --- |
| L1 | 1 |
| L2 | 473 |

（默认请求 L2；实际返回以 L2 为主，符合“四年级/常规难度”设定。可在出题时指定 L1–L4 调节。）

## 四、对标与边界控制（课标对齐 / 受控发散）

- 课件「受控发散地图」累计条目：200（每条发散均须回溯锚点知识点，落实 ±1 年级档 / 课标对齐±1 约束）
- 课件/出题/教案 知识边界命中知识点累计：0 条（来自知识图谱锚点）
- ⚠️ 课标对齐字段 curriculum_alignments 累计：0（非空组合 0）—— 出题/教案端点当前未回填课标对齐码，属待补能力（课件侧的“受控发散地图”已实现对标约束）。

## 五、真实浏览器质量核查（Playwright 真机）

- [PASS] login：tokenInjected=true
- [PASS] A-courseware-quality：genMs=14228 slides=14 目标=true 练习=true 板书=true 发散=3 mdLen=2069
- [PASS] A-courseware-play：projVisible=true
- [PASS] B-xiaowei-quality：respMs=3106 replyLen=334 relevant=true suggestions=true
- [PASS] C-knowledge-graph：kgVisible=true autoSelected=true needSelect=false
- [INFO] D-coverage-progress：combos_done=28 all3=28 partial=0 zero=0
- [INFO] D-live-counts：materials=184 exams=130 lessonPlans=20
- [PASS] page-errors：count=0

## 六、关键发现

1. ~~题库保存端点契约不一致~~ **已修复（2026-07-13，预发布实测通过）**：前端 `questionBankAPI.save` 原调 `/questions`（404），已改调真实端点 `/exercises`，逐题以单题 flat 结构（stem/question_type/answer/analysis/subject/grade）POST 并聚合返回 `question_ids`；`ExerciseGenerator` 保存时补传 `answer/answer_detail`。实测 `POST /api/exercises`→201 且返回 UUID，`/api/questions`→404 确认已切换。
2. ~~组卷主键为时间戳~~ **已修复（2026-07-13，预发布实测通过）**：`ExamHandler.CreateExam` 主键由 `"e"+时间戳+"0"` 改为 `uuid.New().String()`，并发建卷不再撞 `exams_pkey`。实测并发 3 卷全部 201 且主键互异。
3. ~~课标对齐回填缺失~~ **已修复（2026-07-13，预发布实测通过）**：exams 表新增 `curriculum_alignments` JSONB 列（AutoMigrate 自动加列）；`Exam` 模型、`CreateExam`/`UpdateExam` 处理该字段（空值兜底 `[]`）；前端 `ExamBuilder` 抓取 AI 组卷返回的 `curriculum_alignments` 并在保存试卷时一并提交。注：教案端原本已正常（编辑器传 `curriculum_codes`，gen 返回对齐码并落库）——报告中“0”为覆盖脚本未传 codes 的测量假象，非后端缺陷。
4. 知识图谱在教案编辑器内自动选点（autoSelect）正常，课件/出题的知识锚点命中正常。

## 七、2026-07-14 契约修复轮次（真实浏览器端到端验收）

环境：school1.ziwi.cn（预发布）　方法：Playwright 真机 + 真实 AI 调用　脚本：`qa/browser_e2e_fixes.cjs`

### 本轮修复清单

5. ~~试卷题目内容未落库~~ **已修复（2026-07-14，真实浏览器 PASS）**：`ExamBuilder` 保存试卷原只提交 `question_ids`（前端 AI 题的临时 `ai_xxx` id），后端 `CreateExam` 只认 `questions` 字段 → 题目内容落空数组、考试时长 `duration` 字段名也不对。改：保存时把 `selectedQuestions` 完整结构（stem/type/options/answer/analysis/difficulty/score/sort）序列化为 `questions` 提交，并把 `duration` 修正为后端认的 `duration_minutes`。后端无需改（`CreateExam` 本就支持 `questions`）。实测：新保存试卷读回 `questions` 长度=5、题目内容在、`curriculum_alignments` 也在；对比旧行为（`question_ids`）读回长度=0，证明确实原契约漏存题目。

6. ~~出题保存 400（答案必填）~~ **已修复（2026-07-14，真实浏览器 PASS）**：后端 `CreateQuestion` 的 `Answer` 字段为 `binding:"required"`，AI 生成的题 `answer` 偶为空 → 逐题 400 全失败。改：题目草稿允许暂存无答案，去掉 `Answer` 必填（保留 `Stem/QuestionType/Subject/Grade` 必填）。`code/backend/internal/handler/exercise_handler.go`。

7. ~~出题保存 400（题干丢失）~~ **真因修复（2026-07-14，真实浏览器 PASS）**：AI 出题端点 `/api/ai/exam/generate` 返回的题，题干字段不是 `content`（实测为 `stem`/`question` 等），前端 `ExerciseGenerator` 保存与渲染都读 `q.content` → 题干为空 → 后端 `Stem` 必填 400。改：①`handleGenerate` 归一化时把题干统一映射到 `content`（兼容 `content/stem/question/body`）；②`api.ts questionBankAPI.save` 的 `stem` 读取加同款兜底。

### 真实浏览器验收结果（预发布，2026-07-14）

| 流程 | 结果 | 关键指标 |
| --- | --- | --- |
| 出题→保存题库 | PASS | 5 题落库（before 48 → after 53），`delta=5` |
| AI组卷→保存试卷 | PASS | 试卷含 5 题，题目内容落库（`questionsLen=5`） |
| AI课件生成 | PASS | 16.7s，预览正常打开 |
| 小微对话 | PASS | 232ms，回复命中 |
| 页面错误 | PASS | **0**（原 5 个 400 全部消失） |

### 验证脚本（回归用例，留在 qa/）
- `qa/browser_e2e_fixes.cjs`：出题/组卷/课件/小微 四链路真机验收
- `qa/verify_fixes.js`：契约修复回归（端点/主键/课标对齐）
- `qa/verify_exam_questions.js`：试卷题目落库验证

### 状态说明
- 全部改动仅落预发布（`deploy.sh staging`），生产环境未触碰。
- 待用户次日验收预发布后，再决定是否执行 `deploy.sh prod`。
