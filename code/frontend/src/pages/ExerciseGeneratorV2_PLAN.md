# 出题 V1 开发计划

> 制定日期: 2026-06-22 | 技术栈: React + G6 + PostgreSQL JSONB
> 总工时: 3天 | 开发-测试-部署一体化

---

## Phase 1: 知识数据 + G6 核心图谱（Day 1 上午）

### 1.1 知识 JSON 数据 `code/frontend/public/knowledge-graph.json`
```
层级: 学段 → 年级 → 学期 → 单元 → 知识点
覆盖: 数学 1-6 年级 (核心学科优先)
数量: 约 200 个知识点节点
字段: id, name, grade, semester, unit, difficulty(L1-L4),
      cognitive(记忆/理解/应用/分析/评价/创造),
      curriculum_code(课标编号), parent_id, prerequisites[]
```

### 1.2 新建 `KnowledgeGraph.tsx` 组件
```
├── G6 Graph 初始化 (Canvas 模式)
├── 3 种布局: Tree(默认) / Circular / Force
├── 4 种维度切换: 知识点/能力/难度/课标
├── 难度滑块 [L1 ████ L4]
├── MiniMap 缩略图 (右下角)
├── 双击钻取微观图谱
├── 悬停卡片 (300ms delay, 显示名称/难度/状态/题数)
└── 单击选中 (边框高亮 + 右侧面板)
```

### 1.3 新建 `KnowledgePanel.tsx` 组件（右侧属性面板）
```
├── 知识点详情 (名称/章节/课标编号/难度/认知层级)
├── 前置/后继知识点列表
├── 勾选出题范围 (checkbox)
└── 已选列表 + 清除/全选按钮
```

### 1.4 新建 `KnowledgeGraph.css` 样式文件
```
├── 节点样式 (圆形/矩形, 颜色映射)
├── 边样式 (实线→前置, 虚线→关联)
├── 悬停/选中/高亮状态
├── MiniMap 样式
└── 动画 (节点闪烁/平滑过渡)
```

---

## Phase 2: 交互增强 + 出题 UI 升级（Day 1 下午）

### 2.1 KnowledgeGraph 交互扩展
```
├── 右键上下文菜单 (查看详情/标重点/取消/仅显示路径)
├── 框选批量操作 (Lasso Select → 批量出题/标记)
├── 布局切换动画 (500ms 节点/边平滑过渡)
├── 全图适配按钮 + 重置按钮
└── 难度着色开关 (绿-蓝-橙-红  vs  统一蓝)
```

### 2.2 ExerciseGenerator 改造
```
├── 命题用途选择器 (替换现有表单区域)
│   └── 卡片式: 课堂练习/课后作业/单元检测/期中/期末/模拟/奥数
├── 题目类型扩展选择
│   ├── 基础: 选择/填空/计算 (已有)
│   ├── 进阶: 判断/匹配/完形/阅读/解答/作图/写作
│   └── 奥数: 逻辑/数论/行程/工程/浓度/几何计数/数列/抽屉
├── 难度自动推荐 (根据用途)
└── 知识图谱嵌入 (右侧或折叠面板)
    ├── 勾选节点 → 同步到出题范围
    └── 覆盖分析 (出题后显示哪些知识点已覆盖/缺失)
```

### 2.3 组件间数据流
```
KnowledgeGraph ──selectedNodes──→ ExerciseGenerator
ExerciseGenerator ──出题结果──→ KnowledgeGraph (覆盖着色)
                                ↓
                         CoverageReport 弹窗
```

---

## Phase 3: 进阶题型 + 后端 API（Day 2）

### 3.1 后端知识点 API `POST /api/v1/knowledge/query`
```go
// internal/model/models.go 新增
type KnowledgePoint struct {
    ID, Name, Subject string
    GradeLevel int
    DifficultyLevel string // L1-L4
    CognitiveLevel  string // 记忆/理解/应用/分析/评价/创造
    CurriculumCode  string
    ParentID, Prerequisites, NextPoints []string
}

// 新增 handler/knowledge.go
func (h *KnowledgeHandler) Query(c *gin.Context) // 按学科+年级查询

// 路由: GET /api/v1/knowledge/points?subject=数学&grade=4
// 返回: JSON 知识树
```

### 3.2 后端出题增强 `POST /api/v1/ai/exam/generate`
```go
// 请求体扩展
{
  ...原有字段,
  "purpose": "单元检测",          // 新增
  "question_types": ["choice","fill","应用题"], // 扩展
  "school_style": "北京四中",     // 新增
  "difficulty_mix": {"L1":3,"L2":5,"L3":2},  // 新增难度配比
  "selected_knowledge_ids": [...] // 新增
}
```

### 3.3 AI Prompt 更新 `ai-service/prompts/exam_generate.txt`
```
注入要素:
- 命题用途 → 影响题量、难度配比、题型分布
- 名校风格 → 影响题干风格、设问方式
- 难度配比 → 精确控制各难度占比
- 知识点范围 → 确保覆盖指定知识点
```

### 3.4 AI 服务扩展 `api_server.py`
```python
# 新增端点 POST /api/knowledge/search
# 从 PostgreSQL 查询知识库
# 支持 GraphRAG 风格的关联检索
```

---

## Phase 4: 名校风格 + 联调部署（Day 2 下午 ~ Day 3）

### 4.1 名校风格实现
```tsx
// ExerciseGenerator 中新增组件
<SchoolStyleSelector>
  {SCHOOLS.map(s => (
    <Card onClick={select}>
      <Avatar>{s.initials}</Avatar>
      <Name>{s.name}</Name>
      <Desc>{s.features}</Desc>
    </Card>
  ))}
</SchoolStyleSelector>
// 选择后注入到 AI Prompt: "请模拟{school}的命题风格..."
```

### 4.2 覆盖分析报告
```tsx
// 出题完成后展示
<CoverageReport>
  <ProgressBar percent={coverageRate} />
  <List>
    {knowledgePoints.map(kp => (
      <Row>
        <Icon status={kp.covered ? '✅' : '⚠️'} />
        <Name>{kp.name}</Name>
        <QuestionCount>{kp.questionCount} 题</QuestionCount>
        <ExpandButton>查看题目</ExpandButton>
      </Row>
    ))}
  </List>
</CoverageReport>
```

### 4.3 联调验证
```
1. G6 图谱渲染性能: 200节点 < 60fps
2. 出题 API 响应: < 5s (Qwen 真实生成)
3. 知识点 API 响应: < 200ms
4. 前端-后端联调: 覆盖分析数据流
```

### 4.4 部署
```
1. rsync 前端 src/ + public/
2. Docker build 前端 dist
3. Go backend 重新编译 + 重启 API 容器
4. AI service 重新编译 + 重启
5. PostgreSQL 知识库表结构 + 初始化数据
```

---

## 文件清单

### 新增文件
| 文件 | 说明 |
|------|------|
| `frontend/public/knowledge-graph.json` | 1-6年级数学知识点数据 |
| `frontend/src/components/KnowledgeGraph.tsx` | G6 图谱组件 |
| `frontend/src/components/KnowledgeGraph.css` | 图谱样式 |
| `frontend/src/components/KnowledgePanel.tsx` | 右侧属性面板 |
| `frontend/src/pages/ExerciseGenerator.tsx` | 重写出题页 |
| `frontend/src/components/CoverageReport.tsx` | 覆盖分析报告组件 |
| `backend/internal/handler/knowledge.go` | 知识点 API Handler |
| `backend/internal/model/models.go` | +KnowledgePoint 模型 |
| `backend/internal/repository/repository.go` | +KnowledgeRepo |
| `ai-service/prompts/exam_generate.txt` | 更新 Prompt 模板 |
| `ai-service/api_server.py` | +/api/knowledge/search |

### 修改文件
| 文件 | 说明 |
|------|------|
| `backend/cmd/server/main.go` | +knowledge 路由 |
| `backend/internal/handler/business.go` | exam/generate 扩展参数 |
| `frontend/src/lib/api.ts` | +knowledgeAPI |
| `frontend/src/App.tsx` | 路由不变(复用 exercises/new) |

---

## 预估工时

| Phase | 内容 | 工时 |
|-------|------|:---:|
| Phase 1 | 知识数据 + G6 核心图谱 | 4h |
| Phase 2 | 交互增强 + 出题 UI 升级 | 4h |
| Phase 3 | 进阶题型 + 后端 API | 6h |
| Phase 4 | 名校风格 + 联调部署 | 4h |
| **总计** | | **18h / ~3天** |

---

## 前置依赖

```
npm install @antv/g6
```

G6 通过 npm 安装，前端构建时打包进 JS bundle，**Node.js 服务端无需额外配置**。

---

计划确认后开工。
