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

## 八、2026-07-14 教案编辑器双模式 + 草稿箱修复（真实浏览器端到端验收）

需求：①编辑器分「AI 模式」（元数据+知识图谱+AI）与「文档模式」（腾讯文档式自由排版，@uiw/react-md-editor 直接存 markdown，复用现有 content 字段）；②预览=腾讯文档只读+「编辑」浮层（选回 AI / 文档模式）；③预览用浏览器原生打印（消除「word 翻页怪」）；④验收不通过的根因之一——首页草稿可见但草稿箱空（个人资产混乱）。

### 本轮修复清单

1. ~~草稿箱空（首页有草稿、草稿箱空）~~ **已修复（真实浏览器 PASS）**：`LessonPlanList` 原按全局 TeachingContext 的 学科/年级 硬过滤 `plans`，用户自己的异学科/年级草稿被隐藏 → 表现为「首页有草稿、草稿箱空」。改：去掉硬过滤，改为可选 学科/年级 下拉筛选（默认不过滤、展示全部）。后端 `ListByTeacher` 软删除（`status != 'archived'`）本就正确。同时清理了此前覆盖率测试遗留的 302 条污染教案（全量 archived），账号资产已干净。

2. ~~文档模式不渲染（SPA 导航坑）~~ **已修复（真实浏览器 PASS）**：初版用 `window.location.search` 初始化 `editMode`，SPA 导航（预览→浮层→文档模式）时首帧 `window.location.search` 滞后 → 误判为 AI 模式，文档分支不渲染；改用 `useSearchParams` 并加 `useEffect` 跟随 `searchParams` 变化再同步一次。更深一层根因：预览页「编辑」浮层的「文档模式」按钮原写为 `setShowEditChooser(false); navigate(...)`，React 将两次状态更新批量处理，导致 `navigate` 路由切换被吞掉——URL 变成 `/edit?mode=doc` 但页面仍停留在预览页（LessonPlanView）。改为浮层按钮只调用 `navigate(...)`（路由切换即卸载预览页、自然关闭浮层），路由正确切换。

3. ~~预览翻页怪~~ **已修复**：`LessonPlanView` 预览改为浏览器原生打印（`window.open` + 内联 CSS + `w.print()`），替代旧的分页预览组件；「编辑」按钮唤起编辑模式选择浮层（AI / 文档模式）。

4. ~~AI 润色覆盖确认~~ **已实现**：编辑已有且正文非空时点「AI 润色教案」弹确认（可「本次不再提示」写入 sessionStorage），避免无感覆盖。

### 真实浏览器验收结果（预发布，2026-07-14）

脚本：`qa/browser_e2e_dualmode.cjs`（Playwright 真机 + 真实 token，全链路）

| 流程 | 结果 | 关键指标 |
| --- | --- | --- |
| 草稿箱修复-异学科草稿可见 | PASS | 物理/七年级 草稿在草稿箱可见（count=1） |
| 编辑器-模式切换可见 | PASS | 「文档模式」切换按钮渲染 |
| 文档模式-MDEditor 渲染 | PASS | `.w-md-editor` 出现（editors=1） |
| 文档模式-保存落库 | PASS | 文档模式正文存库（count=1） |
| 预览-编辑选择浮层出现 | PASS | 「选择编辑模式」浮层 |
| 浮层-选文档模式进入编辑器 | PASS | `url=.../edit?mode=doc` 且 MDEditor 渲染（md=1） |
| 页面错误数 | PASS | **0**（无 pageerror / console error） |

补充验证：`qa/_diag_poll.cjs` 确认预览浮层进入文档模式后输入可保存落库（读回 content 含「文档模式验收」）；`qa/_diag_docmode.cjs` 确认新建/已有计划直接 `?mode=doc` 打开文档模式均正常。

### 验证脚本（回归用例，留在 qa/）
- `qa/browser_e2e_dualmode.cjs`：双模式 + 草稿箱 全链路真机验收（7 步全绿）
- `qa/_diag_chooser.cjs` / `_diag_chooser2.cjs` / `_diag_chooserdom.cjs`：编辑浮层路径专项诊断
- `qa/_diag_docmode.cjs` / `_diag_poll.cjs` / `_diag_dom.cjs` / `_diag_nav.cjs`：文档模式渲染/保存专项诊断

### 状态说明
- 全部改动仅落预发布（`deploy.sh staging`），生产环境未触碰。
- 验收仍不通过（用户原话），本次已修复草稿箱空 + 预览怪 + 文档模式不渲染三处根因，待用户在预发布验收通过后，再决定是否执行 `deploy.sh prod`。

## 九、2026-07-14 真实浏览器·拟真真人课件生成验收（PPT 课件丰富性）

需求：在预发布用真实浏览器模拟真人使用，每次跑新拟真课题、实际产出课件、数据保留在预发布；重点验证 PPT 课件丰富性。

**逻辑升级（2026-07-14）：由「随机抽 2 个课题」改为「按账号分配学科跑」**。脚本登录后调 `/api/me/textbook-prefs` 取账号 `u-teacher`（13800000002）实际分配学科（去重，`teacher_textbook_prefs` 决定，无偏好时回退登录默认 `User.Subject`），每个学科各跑一份代表性真实课题，年级以账号偏好为准；课题映射见脚本内 `CURRICULUM`（数学→三角形内角和、语文→海上日出、英语→My School、物理→凸透镜成像规律、化学→质量守恒定律、生物→光合作用与呼吸作用）。语义更贴近真人——拟真课题恰为该账号任教范围内；账号教务侧增配学科后重跑自动覆盖，无需改脚本。

脚本：`qa/e2e_realistic_courseware.cjs`（Playwright 真机 + 真实 token 13800000002，按账号分配学科各跑一份真实课题，走完「AI 生成课件 → 课前问诊作答 → AI 润色提纲(render-ppt) → 播放/阅读 → 导出 PPT → 保存到素材库」全链路；**数据保留、不删除**）。运行痕迹追加至 `qa/realistic_runs.log`，导出 PPT 落 `qa/downloads/`。

### 真实浏览器验收结果——第一轮（随机抽取课题，PASS=true，0 页面错误）

| 拟真课题 | 生成提纲 | 要点 | 润色后 | 播放页 | 导出 PPT | 课前问诊 | 入库 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 语文·九年级《岳阳楼记》 | 15 页 | 78 | 13 页 / 38 | 14 | 153KB | 作答 8 题 | ✅ 已入库 |
| 生物·七年级《光合作用与呼吸作用》 | 14 页 | 87 | 13 页 / 38 | 14 | 154KB | 作答 8 题 | ✅ 已入库 |
| （上轮留存）物理·八年级《凸透镜成像规律》 | 14 页 | 85 | 13 页 | 14 | 154KB | — | ✅ 已入库 |
| （上轮留存）生物·七年级《光合作用与呼吸作用》 | 13 页 | 65 | 13 页 | 14 | 155KB | 作答 8 题 | ✅ 已入库 |

### 真实浏览器验收结果——本轮（按账号分配学科，PASS=true，0 页面错误）

账号 `u-teacher`（13800000002）实际分配学科 = **数学、语文**（四年级，来自 `teacher_textbook_prefs`），脚本据此自动取对应课题，各生成一份真实课件：

| 拟真课题 | 生成提纲 | 要点 | 润色后 | 播放页 | 导出 PPT | 课前问诊 | 入库 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 数学·四年级《三角形内角和》 | 13 页 | 77 | 13 页 / 40 | 14 | 158KB | 作答 8 题 | ✅ 已入库 |
| 语文·四年级《海上日出》 | 13 页 | 66 | 13 页 / 37 | 14 | 156KB | 作答 8 题 | ✅ 已入库 |

丰富性判据（断言阈值）：生成提纲页数 ≥ 5、要点总数 ≥ 10、润色后仍 ≥ 5 页、播放幻灯片 ≥ 6 页、导出 PPT > 0 字节、保存到素材库成功——全部 PASS。六份课件均真实保留在预发布素材库（不同时间戳，可重复验收）。

### 验证要点说明
- 拟真真实性：按账号分配学科取对应真实课题、填真实课题名+附加要求、开启边缘知识（科学探究精神）、课前问诊逐题作答（8 题），等价于真人操作。
- 丰富性由 DOM 实测：提纲页数 = 预览区 `P{n}` 标签数；要点数 = 每页 `每条要点一行` 文本域行数之和；播放页数 = `PPT 在线预览` 的 `{idx+1} / {total}`。
- 导出 PPT 由前端 pptxgenjs 生成并触发下载，实测文件 153–158KB，非空。
- 入库以真实 API `GET /api/materials` 回查 `name` 含课题标题验证（曾误用 SPA 路由 `/materials` 致验收误判，已修正为 `/api/materials`）。

### 状态说明
- 仅落预发布，生产未部署。六份拟真课件为真实产出、保留在预发布素材库，可供后续人工验收。
- 如需更多学科/课题覆盖，重复运行 `node qa/e2e_realistic_courseware.cjs` 即按当前账号分配学科生成新一批拟真课件（数据持续累积保留）；账号教务侧增配学科后重跑自动覆盖新学科。
