# 出题功能问题修复方案

> 日期: 2026-06-22 | 状态: 待确认后编码

---

## 问题1: 学科/年级不同步

### 现象
- 右上角选择 "三年级·语文"
- 出题页学科下拉框显示 "数学"，年级显示 "四年级"
- 三个地方不统一：TopNavBar / SideBar / 出题表单

### 方案
**全局状态管理** (推荐) 或 **localStorage 同步**

```
方案A: React Context (推荐，无需额外依赖)
├── 新建 TeachingContext.tsx
│   ├── subject: '语文' | '数学' | '英语'
│   ├── grade: 1-9
│   ├── semester: '上' | '下'
│   ├── currentUnit: string (当前单元)
│   └── currentLesson: string (当前课文/课时)
│
├── TopNavBar 读取并展示
├── SideBar 底部用户信息展示
├── ExerciseGenerator 表单初始化读取
└── 修改时通知所有订阅组件

方案B: localStorage (简单，页面刷新保持)
├── localStorage.setItem('zhiwei_teaching', JSON.stringify({subject, grade, semester, unit}))
├── 各组件 useEffect 监听 storage 事件同步
└── 登录时从用户配置初始化
```

### 建议
采用 **方案A (Context)**，数据流清晰，响应即时。

---

## 问题2: 教学计划概念 + 年级上下学期 + 单元对应

### 需要定义的数据模型

```typescript
// 教学计划 TeachingPlan
interface TeachingPlan {
  id: string
  teacher_id: string
  subject: string
  grade: number
  semester: '上' | '下'
  textbook_version: string  // 部编版/人教版/北师大版...
  
  // 当前进度
  current_unit: string      // 当前单元ID
  current_lesson: string    // 当前课文/课时ID
  progress_percent: number  // 学期进度 0-100%
  
  // 完整计划
  units: Unit[]
}

interface Unit {
  id: string
  name: string              // "第一单元：分数加减法"
  order: number             // 单元顺序
  knowledge_points: string[] // 关联知识点ID列表
  lessons: Lesson[]
}

interface Lesson {
  id: string
  name: string              // "第1课时：同分母分数加法"
  order: number
  knowledge_points: string[]
  estimated_hours: number   // 预计课时
}
```

### UI 改造

```
出题页新增「教学进度」区域：
┌─────────────────────────────────────────────┐
│ 当前教学进度                                 │
│ 四年级 · 数学 · 下册 · 部编版               │
│ [=====>          ] 第3单元/共8单元 (37%)    │
│                                             │
│ 单元: [▼ 第三单元：分数加减法]              │
│ 课时: [▼ 第2课时：异分母分数加法]           │
│                                             │
│ [出题覆盖本单元] [出题覆盖本课时]           │
└─────────────────────────────────────────────┘
```

### 数据来源
- **短期**: Mock 数据，预设 1-6 年级数学各版本教学计划
- **长期**: 从教师教案数据自动提取当前进度

---

## 问题3: AI 计算缺省值

### 当前状态
所有字段都是硬编码默认值或空值。

### AI 智能推荐方案

| 字段 | 当前 | AI 推荐逻辑 |
|------|------|-------------|
| **学科** | 硬编码"数学" | 从教学计划读取当前学科 |
| **年级** | 硬编码"四年级" | 从教学计划读取 |
| **命题用途** | 默认"课后作业" | 根据当前时间判断：
│   │   │   • 周四/周五 → "周末作业" |
│   │   │   • 月末 → "月考" |
│   │   │   • 学期中/末 → "期中/期末" |
│   │   │   • 默认 → "课后作业" |
| **知识点** | 空 | 根据当前课时推荐：
│   │   │   • 读取当前 lesson.knowledge_points |
│   │   │   • 或根据教学进度自动填充 |
| **题量** | 10 | 根据用途自动推荐：
│   │   │   • 课堂练习 → 3-5题 |
│   │   │   • 课后作业 → 5-10题 |
│   │   │   • 单元检测 → 15-20题 |
| **难度** | L2 | 根据年级+用途智能推荐：
│   │   │   • 1-2年级 → L1 |
│   │   │   • 3-4年级课后作业 → L1-L2 |
│   │   │   • 5-6年级单元检测 → L2-L3 |
| **题型** | [选择,填空,计算] | 根据学科智能推荐：
│   │   │   • 数学 → 选择/填空/计算/解答 |
│   │   │   • 语文 → 选择/填空/阅读/写作 |
│   │   │   • 英语 → 选择/完形/阅读/写作 |

### 实现方式

```typescript
// AI 推荐服务 (前端计算，无需后端)
const AIRecommendation = {
  // 根据时间推荐用途
  suggestPurpose(): string {
    const day = new Date().getDay() // 0=周日
    const date = new Date().getDate()
    if (day === 4 || day === 5) return 'weekend'
    if (date > 25) return 'monthly'
    // ...更多规则
    return 'homework'
  },
  
  // 根据教学计划推荐知识点
  suggestKnowledgePoints(plan: TeachingPlan): string[] {
    return plan.current_lesson?.knowledge_points || []
  },
  
  // 根据用途推荐题量
  suggestCount(purpose: string): number {
    const map: Record<string, number> = {
      'classwork': 5,
      'homework': 8,
      'unit_test': 18,
      'monthly': 22,
      'midterm': 28,
      'final': 32,
    }
    return map[purpose] || 10
  },
  
  // 综合推荐
  generateDefaults(plan: TeachingPlan) {
    const purpose = this.suggestPurpose()
    return {
      subject: plan.subject,
      grade: plan.grade,
      purpose,
      knowledgePoints: this.suggestKnowledgePoints(plan),
      count: this.suggestCount(purpose),
      difficulty: this.suggestDifficulty(plan.grade, purpose),
      types: this.suggestTypes(plan.subject),
    }
  }
}
```

---

## 问题4: 知识图谱打不开

### 可能原因分析

| 原因 | 检查 | 解决方案 |
|------|------|----------|
| **G6 未安装** | npm list @antv/g6 | 已安装 v4.8.24 ✅ |
| **JSON 数据 404** | /knowledge-graph.json | 已部署 ✅ |
| **G6 v5 API 不兼容** | build 报错 | 已降级 v4 ✅ |
| **容器构建未成功** | dist/knowledge-graph.json 存在 | 已存在 ✅ |
| **运行时 JS 报错** | 浏览器 Console | 需排查 |
| **数据格式错误** | JSON parse | 需验证 |

### 需排查项

```bash
# 1. 验证 JSON 可访问
curl http://school.ziwi.cn/knowledge-graph.json | head -5

# 2. 验证 G6 在构建产物中
grep -o '@antv/g6' /opt/zhiwei/code/frontend/dist/assets/index-*.js | wc -l

# 3. 浏览器 Console 错误（需用户协助）
# 按 F12 → Console → 查看红色报错
```

### 备选方案

如 G6 持续有问题，备选：**ECharts Graph** 或 **纯 CSS Grid 简化版**

---

## 问题5: 教材版本 (全面版)

### 5.1 穷举完整教材版本

参考教材预订网、电子课本网等，全国在用小学教材版本如下：

#### 语文 (全国统一)
| 版本 | 标识 | 覆盖范围 |
|------|:--:|------|
| **统编版 (部编版)** | 部编 | 全国统一，2019年起全面推行 |

> 语文无差异，AI 输出统一按部编版处理。

#### 数学 (多版本并行)
| 版本 | 标识 | 主要使用省份 |
|------|:--:|------|
| **人教版** | 人教 | 河北、河南、湖北、湖南、广西、贵州、云南、西藏、青海、新疆、内蒙古、甘肃、宁夏、黑龙江、吉林、辽宁 |
| **北师大版** | 北师大 | 北京、天津、陕西、安徽、福建、广东(部分)、浙江(部分) |
| **苏教版** | 苏教 | 江苏全省、山西(部分)、江西(部分) |
| **沪教版** | 沪教 | 上海 |
| **冀教版** | 冀教 | 河北(部分) |
| **青岛版** | 青岛 | 山东(部分) |
| **西师大版** | 西师 | 四川、重庆 |

#### 英语
| 版本 | 标识 | 主要使用省份 |
|------|:--:|------|
| **人教版 (PEP)** | PEP | 全国多数地区 |
| **外研版** | 外研 | 北京、天津、辽宁、山东、广东(部分) |
| **牛津版** | 牛津 | 上海、江苏(部分) |
| **冀教版** | 冀教 | 河北 |

> 数据来源: 教材预订网、电子课本网，反映当前各省教材使用情况

### 5.2 不同教材版本对 AI 的影响

| 影响维度 | 具体差异 | AI 应对策略 |
|----------|----------|-------------|
| **知识点顺序** | 人教版四下"小数的意义"在前→"三角形"在后；北师大版四下"三角形"在前→"小数"在后 | Prompt 注入版本+年级+学期，LLM按对应顺序出题 |
| **单元命名** | 人教"多边形的面积" vs 苏教"多边形面积计算" vs 北师大"图形与几何" | 知识点 ID 统一映射，Prompt 中做别名替换 |
| **概念引入方式** | 人教版用生活情境导入分数，北师大版用几何图形导入 | AI 出题时模拟对应版本的教学风格 |
| **难度分布** | 苏教版偏思维拓展(奥数倾向)，人教版偏基础巩固 | 同一难度 L2 在不同版本中对应不同复杂度 |
| **习题风格** | 人教版重重复练习(题量大)，苏教版重情境探究(题干长) | Prompt 注入版本风格描述 |
| **课标覆盖** | 核心知识点一致，但扩展深度不同 | RAG 检索时按版本过滤课标条目 |

### 5.3 学校级别教材锁定机制

```
原则: 学校一旦选定教材版本，不轻易更换

数据模型:
School {
  ...
  textbook_math: '人教版'      // 数学教材锁定版本
  textbook_english: 'PEP'       // 英语教材锁定版本
  textbook_locked_at: datetime   // 锁定时间
  textbook_locked_by: string     // 锁定人 (教务管理员ID)
}

变更流程:
教师端 → "申请变更教材版本"
  ├── 弹出确认框: "变更教材版本将影响所有教案和出题基准，确定继续？"
  ├── 填写申请理由 (必填, 30字以上)
  └── 提交 → 教务管理员审核

教务端 → 审核通知
  ├── 查看申请详情 (申请人/原版本/新版本/理由)
  ├── [批准] → 更新 School.textbook_* 字段
  └── [拒绝] → 通知申请人并附原因

前端表现:
├── 设置页: 显示当前教材版本 (只读，旁有"申请变更"按钮)
├── TopNavBar: 显示当前教材版本 (只读标签)
├── 出题页: 自动读取 School.textbook_math 锁定版本
└── 教案编辑器: 自动读取教材版本用于课标对齐
```

### 5.4 AI 计算链 (完整)

```
输入: TeachingContext {subject, grade, semester, textbook_version, current_unit}

Step 1: 教材版本 → 加载对应 textbook-math.json
  └→ 获取该版本的知识点顺序、单元划分

Step 2: 年级+学期 → 定位到具体单元
  └→ 四年级下册 + 部编版 → [{第1单元:四则运算, KPs:[...]}, {第2单元:观察物体,...}, ...]

Step 3: current_unit → 提取当前单元的知识点列表
  └→ ["m-4-1-1", "m-4-1-2", ...]

Step 4: AI 推荐题量 (时间智能)
  ├→ 星期五 → 周末作业 → 15-20题
  ├→ 月末 → 月考 → 20-25题
  └→ 默认 → 课后作业 → 8-10题

Step 5: AI 推荐难度 (年级+版本智能)
  ├→ 四年级 + 苏教 → L2偏L3 (苏教难度偏大)
  ├→ 四年级 + 人教版 → L2居中
  └→ 三年级 + 任意 → L1偏L2

Step 6: AI Prompt 注入
  ├→ "你是一名{textbook_version}教材命题专家"
  ├→ "当前教学进度: {grade}年级{semester}学期"
  ├→ "请覆盖以下知识点: {knowledge_points}"
  ├→ "命题风格: {style_desc}"
  └→ "难度配比: L1:{n1}题 L2:{n2}题 L3:{n3}题"
```

---

### 全局状态 TeachingContext (最终版)

```typescript
interface TeachingContext {
  // 学科 (与 School 配置联动)
  subject: '语文' | '数学' | '英语'
  grade: number              // 1-9
  semester: '上' | '下'
  
  // 教材 (学校锁定，不可轻易变更)
  textbook_math: string      // '人教版' | '北师大版' | '苏教版' | '沪教版' | '冀教版' | '青岛版' | '西师大版'
  textbook_english: string   // 'PEP' | '外研版' | '牛津版' | '冀教版'
  textbook_locked: boolean   // 已锁定标识
  
  // 进度
  current_unit_name: string  // '第三单元: 分数加减法'
  current_lesson_name: string // '第2课时: 异分母分数加法'
  progress_percent: number   // 学期进度 0-100%
}
```

### 数据文件结构

```
public/
├── knowledge-graph.json         → 通用知识点 (已有, 70节点)
├── textbook-math.json           → 数学各版本单元-知识点映射 (新增)
│   {
│     "人教版": {
│       "4": {
│         "下": [
│           {"unit": "第一单元: 四则运算", "kps": ["m-4-1-1","m-4-1-2","m-4-6-1"]},
│           {"unit": "第二单元: 观察物体(二)", "kps": ["m-4-7-1"]},
│           {"unit": "第三单元: 运算定律", "kps": ["m-4-6-1"]},
│           ...
│         ]
│       }
│     },
│     "北师大版": { ... },
│     "苏教版": { ... },
│     "沪教版": { ... }
│   }
└── textbook-english.json       → 英语各版本单元映射 (后续)
```

### AI Prompt 注入模板

```
# exam_generate.txt 更新
你是{textbook_version}教材命题专家。
请严格按照{grade}年级{semester}学期{textbook_version}教材编排，
覆盖以下知识点: {knowledge_points}。
命题风格: {version_style}。
难度配比: {difficulty_mix}。

教材版本特征:
- 人教版: 重视基础概念，题干简洁，设问精准，题量偏大
- 北师大版: 注重思维深度，常设进阶题，探究式学习
- 苏教版: 强调应用能力，结合生活实际，题干较长有情境
- 沪教版: 国际化倾向，注重数学思想方法，拓展性强
```

### 更新后实施计划

| 阶段 | 内容 | 工时 |
|------|------|:---:|
| **Phase A** | TeachingContext (学科/年级/学期/教材/进度) + TopNavBar 教材选择器 | 2h |
| **Phase B** | textbook-math.json 数据 (人教/北师大/苏教 3版本4年级) | 2.5h |
| **Phase C** | AI 缺省值推荐服务 + Prompt 模板更新 | 2h |
| **Phase D** | 学校锁定机制 (锁定状态 + 变更申请) | 1.5h |
| **Phase E** | 知识图谱修复 + 联调部署 | 2h |
| **总计** | | **~10h / 1.5天** |

### 待确认

| # | 问题 | 建议 |
|:-:|------|------|
| 1 | 教材版本先做 3 个 (人教/北师大/苏教)，其他后续？ | 建议先 MVP 3 个 |
| 2 | 英语 PEP/外研版 也做？ | 英语影响较小，可后续 |
| 3 | 语文统编版全国统一无需选择 | 语文学科跳过教材版本选择 |
| 4 | 知识图谱打不开的具体 Console 报错？ | 需查看 F12 输出 |

```
┌─────────────────────────────────────────────────────────────┐
│                      全局状态 TeachingContext                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   subject   │  │    grade    │  │     semester        │ │
│  │   "数学"    │  │      4      │  │      "下"           │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │current_unit │  │current_lesson│  │   textbook_version  │ │
│  │ "分数加减"  │  │ "异分母加法"  │  │     "部编版"        │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
           │              │              │
           ▼              ▼              ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │  TopNavBar  │ │ ExerciseGen │ │KnowledgeGraph│
    │ 显示当前进度 │ │ 表单默认值  │ │ 过滤显示节点 │
    └─────────────┘ └─────────────┘ └─────────────┘
```

---

## 实施计划 (等确认后执行)

| 阶段 | 内容 | 工时 |
|------|------|:---:|
| **Phase A** | TeachingContext 全局状态 + 学科/年级同步 | 2h |
| **Phase B** | 教学计划数据模型 + 年级上下学期 + 单元选择器 | 3h |
| **Phase C** | AI 缺省值推荐服务 + 时间/进度智能判断 | 2h |
| **Phase D** | 知识图谱调试修复 (根据具体报错) | 2h |
| **Phase E** | 联调测试 + 部署 | 1h |
| **总计** | | **~10h / 1.5天** |

---

## 待确认项

| # | 问题 | 建议方案 |
|:-:|------|----------|
| 1 | 年级分上下学期？ | ✅ 是，增加 semester 字段 |
| 2 | 教学计划数据从哪来？ | 方案A: Mock 预设数据 / 方案B: 从教案自动提取 |
| 3 | AI 推荐要不要后端参与？ | 建议纯前端规则计算，响应快 |
| 4 | 知识图谱具体报错？ | 需要用户按 F12 看 Console 报错 |

---

确认以上方案后开工。
