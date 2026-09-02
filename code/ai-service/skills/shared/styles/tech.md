# 风格提示词 · 科技（tech）

> 结构说明见 `code/backend/docs/风格提示词库方案.md`
> 原则：**只描述语义与倾向，不给具体色值**；配色由 Skill 当次生成，随 styleDNA 快照进课件。
> 定位：初高中理科学段（数学/物理/化学/生物/信息技术）。

```yaml
id: tech
name: 科技
version: 1

# ── 语义层：人的定义，永不自动改 ──
semantic:
  气质: 理性、精密、未来感、数据驱动
  形态: 几何构成、网格与轴线、发光描边、模块化分区
  母题: 节点与连线、网格、数据流、坐标轴、电路纹样、几何切面
  禁忌: 卡通形象、花草动物、手绘涂鸦、拟物装饰、暖色童趣元素

# ── 适用边界：硬约束，必须由人定义 ──
fit:
  gradeFit: [小学高段, 初中, 高中]
  subjectFit: [数学, 科学, 信息技术, 物理, 化学, 生物]
  excludeGrade: [小学低段]
  excludeSubject: []

# ── 适配层：数据驱动，可学习 ──
adaptation:
  场景:
    公开课:     { 密度: normal,   装饰强度: light,  说明: 视觉为辅，逻辑与数据为主 }
    导入课:     { 密度: normal,   装饰强度: light,  说明: 用现象或问题导入 }
    新授课:     { 密度: normal,   装饰强度: light,  说明: 结构清晰、层次分明 }
    探究实验课: { 密度: normal,   装饰强度: light,  说明: 突出步骤、变量与数据 }
    起始导览课: { 密度: normal,   装饰强度: medium, 说明: 突出知识结构关系 }
    复习课:     { 密度: compact,  装饰强度: none,   说明: 内容密度优先 }
    讲评课:     { 密度: compact,  装饰强度: none,   说明: 题目与批注为主 }
    练习课:     { 密度: compact,  装饰强度: none,   说明: 留白给解题 }
  学段:
    小学高段: { 色彩丰富度: 中等,   字号倾向: 中 }
    初中:     { 色彩丰富度: 克制,   字号倾向: 常规 }
    高中:     { 色彩丰富度: 近单色, 字号倾向: 常规 }

# ── 素材范围：平台维护，按匹配度进化 ──
asset_scope:
  常用: [grid-dots, chart-grid-dots, circle, square, triangle]
  可用: [cpu, network, function, square-root, math-pi, atom, target, ruler, compass]
  禁用: [flower, leaf, seedling, acorn, butterfly, cat, dog, paw, mushroom, ladybug, rainbow, balloon, christmas-tree]
  学科收敛:
    数学: { 优先: [function, square-root, math-pi, grid-dots, circle, triangle] }
    物理: { 优先: [atom, network, ruler, target] }
    化学: { 优先: [atom, flask, circle] }
    生物: { 优先: [atom, dna, circle] }
    信息技术: { 优先: [cpu, network, server, code] }
    默认: { 说明: 未覆盖学科走 常用+可用 }
  说明: >-
    最终候选集由平台按 匹配度(素材×风格×学科×学段×场景) 计算后取 top N 注入 Skill。

# ── 输出契约 ──
output_contract:
  必须输出: styleDNA（配色 / 字号 / 密度），快照进课件
  禁止输出: 装饰引用中出现裸色值（只能用 主色 / 强调色 / 弱化色 等语义槽）
  素材约束: 只能从平台注入的候选素材 ID 中选用，不得自造新素材

# ── 进化边界：一切都叫匹配度 ──
learning:
  可进化: [候选集排序, 各素材默认参数, 场景适配值, 学段色彩丰富度]
  不可进化: [semantic 语义层, fit 适用边界]
```

---

## 与相邻风格的区别

| | tech 科技 | academic 严谨学术 |
|---|---|---|
| 气质 | 精密、未来感、数据驱动 | 理性、克制、秩序感 |
| 母题 | 节点连线、网格、数据流、电路 | 几何、线条、坐标系、刻度 |
| 适用 | 数学 / 物理 / 化学 / 生物 / 信息技术 | 数学 / 科学 / 信息技术 / 语文 |
| 色彩倾向 | 冷色为主（蓝青紫） | 中性低饱和（蓝灰墨） |

两者都适合理科，可按课题调性二选一：偏数据与现象选 tech，偏推导与论证选 academic。
