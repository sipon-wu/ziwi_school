# 风格提示词 · 严谨学术（academic）

> 结构说明见 `code/backend/docs/风格提示词库方案.md`
> 原则：**只描述语义与倾向，不给具体色值**；配色由 Skill 当次生成，随 styleDNA 快照进课件。
> 定位：初高中理科学段的主力风格（此前风格库偏童趣，初中数学《函数》无风格可用）。

```yaml
id: academic
name: 严谨学术
version: 1

# ── 语义层：人的定义，永不自动改 ──
semantic:
  气质: 理性、克制、清晰、有秩序感
  形态: 几何构成、直线与网格、精确对齐；适度留白
  母题: 几何图形、线条、网格、坐标系、刻度、结构关系
  禁忌: 卡通形象、花草动物、拟物装饰、圆润可爱元素、高饱和撞色

# ── 适用边界：硬约束，必须由人定义 ──
fit:
  gradeFit: [小学高段, 初中, 高中]
  subjectFit: [数学, 科学, 物理, 化学, 生物, 信息技术, 语文]
  excludeGrade: [小学低段]          # 低段需要形象化，不适用纯理性表达
  excludeSubject: []

# ── 适配层：数据驱动，可学习 ──
adaptation:
  场景:
    公开课:     { 密度: normal,   装饰强度: light,  说明: 视觉为辅，逻辑为主 }
    导入课:     { 密度: normal,   装饰强度: light,  说明: 用问题情境导入 }
    新授课:     { 密度: normal,   装饰强度: light,  说明: 结构清晰 }
    探究实验课: { 密度: normal,   装饰强度: light,  说明: 突出步骤与数据 }
    起始导览课: { 密度: normal,   装饰强度: medium, 说明: 突出知识结构 }
    复习课:     { 密度: compact,  装饰强度: none,   说明: 内容密度优先 }
    讲评课:     { 密度: compact,  装饰强度: none,   说明: 题目与批注为主 }
    练习课:     { 密度: compact,  装饰强度: none,   说明: 留白给解题 }
  学段:
    小学高段: { 色彩丰富度: 中等,   字号倾向: 中 }
    初中:     { 色彩丰富度: 克制,   字号倾向: 常规 }
    高中:     { 色彩丰富度: 近单色, 字号倾向: 常规 }

# ── 素材范围：平台维护，按匹配度进化 ──
asset_scope:
  常用: [circle, square, triangle, grid-dots, chart-grid-dots]
  可用: [ruler, compass, calculator, target, function, square-root, math-pi]
  禁用: [flower, leaf, seedling, acorn, butterfly, cat, dog, paw, mushroom, ladybug, rainbow, balloon]
  学科收敛:
    数学: { 优先: [function, square-root, math-pi, grid-dots, circle, triangle], 说明: 几何与数字符号 }
    科学: { 优先: [atom, flask, microscope, ruler], 说明: 实验与观测 }
    语文: { 优先: [book, file, quote], 说明: 文本与论述 }
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
  可进化:
    - 候选集排序
    - 各素材默认参数
    - 场景适配值
    - 学段色彩丰富度
  不可进化:
    - semantic 语义层
    - fit 适用边界          # 学段/学科边界由人定，数据无权推翻
```

---

## 与 forest 的对照

| 维度 | forest 森林童趣 | academic 严谨学术 |
|---|---|---|
| 气质 | 自然、亲切、有生机 | 理性、克制、有秩序 |
| 母题 | 叶片、花草、瓢虫、蘑菇 | 几何、线条、网格、坐标系 |
| 学段 | 小学低段 / 高段 | 小学高段 / 初中 / 高中 |
| 学科 | 语文、英语、科学 | 数学、科学、信息技术 |
| 装饰强度 | 可 rich（导入/公开课） | 最高 light，复习与练习为 none |

**两者互斥**：初中及以上、或理科内容，一律走 academic，不得选 forest。
