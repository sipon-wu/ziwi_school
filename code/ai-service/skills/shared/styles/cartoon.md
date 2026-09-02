# 风格提示词 · 卡通（cartoon）

> 结构说明见 `code/backend/docs/风格提示词库方案.md`
> 原则：**只描述语义与倾向，不给具体色值**；配色由 Skill 当次生成，随 styleDNA 快照进课件。

```yaml
id: cartoon
name: 卡通
version: 1

# ── 语义层：人的定义，永不自动改 ──
semantic:
  气质: 活泼、亲和、有玩心
  形态: 圆润卡通造型、粗描边、明快色块、拟声元素
  母题: 笑脸、星星、气球、彩虹、小动物、玩具
  禁忌: 冷峻科技感、极简留白、严肃学术排版

# ── 适用边界：硬约束，必须由人定义 ──
fit:
  gradeFit: [学前, 小学低段, 小学高段]
  subjectFit: [语文, 英语, 美术, 政治]
  excludeGrade: [初中, 高中]
  excludeSubject: [数学, 物理, 化学]

# ── 适配层：数据驱动，可学习 ──
adaptation:
  场景:
    公开课:     { 密度: normal,   装饰强度: medium }
    导入课:     { 密度: normal,   装饰强度: medium }
    新授课:     { 密度: normal,   装饰强度: light }
    探究实验课: { 密度: normal,   装饰强度: light }
    起始导览课: { 密度: normal,   装饰强度: medium }
    复习课:     { 密度: compact,  装饰强度: none }
    讲评课:     { 密度: compact,  装饰强度: none }
    练习课:     { 密度: compact,  装饰强度: none }
  学段:
    学前:     { 色彩丰富度: 多彩,   字号倾向: 大 }
    小学低段: { 色彩丰富度: 多彩,   字号倾向: 大 }
    小学高段: { 色彩丰富度: 中等,   字号倾向: 中 }
    初中:     { 色彩丰富度: 克制,   字号倾向: 常规 }
    高中:     { 色彩丰富度: 近单色, 字号倾向: 常规 }

# ── 素材范围：平台维护，按匹配度进化 ──
asset_scope:
  常用: [smile, star, balloon, rainbow, heart]
  可用: [cat, dog, fish, paw, gift, candy]
  禁用: [cpu, network, atom, ruler, calculator, function]

# ── 输出契约 ──
output_contract:
  必须输出: styleDNA（配色 / 字号 / 密度），快照进课件
  禁止输出: 装饰引用中出现裸色值
  素材约束: 只能从平台注入的候选素材 ID 中选用，不得自造新素材

learning:
  可进化: [候选集排序, 各素材默认参数, 场景适配值, 学段色彩丰富度]
  不可进化: [semantic 语义层, fit 适用边界]
```

仅学段前与低龄学科（如《快乐涂色》《趣味识字》）；三年级以上一般不再使用。
