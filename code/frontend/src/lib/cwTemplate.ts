/**
 * 课件模板契约（PPT / H5 共用底座）
 * ─────────────────────────────────────────────────────────────
 * 设计原则（用户拍板 2026-08-04）：
 * 1. 风格标签（style）跨媒介统一文案——PPT 与 H5 用同一套风格枚举，老师"认得准"；
 * 2. 素材池按 kind('ppt' | 'h5') 分流——两套模板内容各自独立定义，互不相混；
 * 3. 套用机制（applyTemplate）固化通用：从模板库选 → 一键换肤套用、内容不变、可撤销；
 * 4. 各风格标签下素材"积累多少算多少"，不强制 PPT/H5 对称。
 *
 * 教学版式骨架（SlideLayout 的 edu-* 系列）只定义"结构占位"，不含业务内容；
 * 老师套用后填空式编辑。这与 ciniaoppt 等主流 AI 模板"先生成、后换肤"一致。
 */

// ── 媒介维度：仅负责素材池分流，不决定风格 ──
export type TemplateKind = 'ppt' | 'h5'

// ── 风格标签：PPT / H5 共用同一套文案（用户对齐：标签可复用） ──
export type StyleTag =
  | 'china'        // 国风
  | 'minimal'      // 素净
  | 'tech'         // 科技
  | 'fresh'        // 清新
  | 'academic'     // 严谨
  | 'cartoon'      // 卡通
  | 'flat'         // 扁平
  | 'business'     // 沉稳
  | 'basic'        // 通用（结构 × 色系自由组合）

export const STYLE_LABELS: Record<StyleTag, string> = {
  china: '国风',
  minimal: '素净',
  tech: '科技',
  fresh: '清新',
  academic: '严谨',
  cartoon: '卡通',
  flat: '扁平',
  business: '沉稳',
  basic: '通用',
}

// ── 色系维度：与「通用」结构自由叠加（结构 × 色系 = 一套课件） ──
// 色系从现有 56 套 CwTheme 的 primary 聚类而来，每个色系取一个代表配色；
// 老师选「通用」结构后，再选色系，即"百搭骨架 + 指定配色"自由叉乘。
export interface ColorFamily {
  id: string
  label: string
  themeId: string   // 代表配色（applyTemplate 时使用的真实 CwTheme）
  swatch: string    // 色卡（用于 UI 展示，取代表色 primary）
}

export const COLOR_FAMILIES: ColorFamily[] = [
  { id: 'blue',      label: '蓝系',   themeId: 'aca-edu-blue',       swatch: '#1F4E79' },
  { id: 'cyan-green',label: '青绿系', themeId: 'na-forest',          swatch: '#1E5631' },
  { id: 'red-gold',  label: '红金系', themeId: 'sp-festive',         swatch: '#B5121B' },
  { id: 'warm',      label: '暖棕系', themeId: 'wa-caramel',         swatch: '#8A5A2B' },
  { id: 'purple',    label: '紫粉系', themeId: 'wa-elegant-purple',  swatch: '#5B3A78' },
  { id: 'gray',      label: '灰系',   themeId: 'min-gray-premium',   swatch: '#4A4A4A' },
  { id: 'mono',      label: '黑白系', themeId: 'aca-black-gold',     swatch: '#1C1C1C' },
  { id: 'gradient',  label: '多彩渐变', themeId: 'gr-blue-purple',   swatch: '#3B49C9' },
]

export function getColorFamily(id: string): ColorFamily | undefined {
  return COLOR_FAMILIES.find((f) => f.id === id)
}

// ── 版式：现有纯排版版式 + 新增教学语义版式（全媒介通用） ──
export type SlideLayout =
  | 'title-body'   // 标题+正文
  | 'title-only'   // 仅标题
  | 'two-col'      // 两栏
  | 'blank'        // 空白
  | 'edu-cover'    // 封面（课题+年级/学科/教师信息块）
  | 'edu-goal'     // 教学目标（三维目标三栏）
  | 'edu-explain'  // 知识讲解（概念定义+要点展开）
  | 'edu-example'  // 例题演练（题干+解答步骤）
  | 'edu-summary'  // 课堂小结（要点归纳+导图占位）
  | 'edu-homework' // 作业布置（分层：基础/提高/拓展）

export const LAYOUT_LABELS: Record<SlideLayout, string> = {
  'title-body': '标题+正文',
  'title-only': '仅标题',
  'two-col': '两栏',
  'blank': '空白',
  'edu-cover': '封面',
  'edu-goal': '教学目标',
  'edu-explain': '知识讲解',
  'edu-example': '例题演练',
  'edu-summary': '课堂小结',
  'edu-homework': '作业布置',
}

// 占位区块的类型
export type PlaceholderKind = 'title' | 'body' | 'bullet' | 'info-block'

export interface Placeholder {
  key: string
  label: string
  kind: PlaceholderKind
}

// 单版式的骨架定义（结构占位，无业务内容）
export interface LayoutSkeleton {
  hint?: string
  placeholders: Placeholder[]
}

// ── 学段映射（内置，从 teaching.grade 数字无感解析，教师无需操作） ──
// 方案 B 四档：小学低段(1-3) / 小学高段(4-6) / 初中(7-9) / 高中(10-12)
// 注：前端 GRADE_MAP 当前仅覆盖 1-9，高中档架构预留、暂无触发数据。
export type StageKey = 'lower' | 'upper' | 'middle' | 'high'

const STAGE_OF_GRADE: Record<number, StageKey> = {
  1: 'lower', 2: 'lower', 3: 'lower',
  4: 'upper', 5: 'upper', 6: 'upper',
  7: 'middle', 8: 'middle', 9: 'middle',
  10: 'high', 11: 'high', 12: 'high',
}

export function gradeToStage(grade: number): StageKey {
  return STAGE_OF_GRADE[grade] ?? 'upper'
}

// 学科归一化 key：对齐 code/shared/subjects.ts 的唯一学科事实源（9 个边界学科）。
// 内部按"族"归并骨架差异，族名仅为索引键、不对外暴露。
import { SUBJECT_CODES } from '@shared/subjects'

function subjectKey(subject: string): string {
  if (subject in SUBJECT_CODES) return subject // 已是标准中文名，直接命中
  return '_default'
}

// 学科族：物理/化学/生物 → 实验理科；历史/地理/政治 → 人文；其余按原名
function subjectFamily(subject: string): string {
  if (['物理', '化学', '生物'].includes(subject)) return 'science'
  if (['历史', '地理', '政治'].includes(subject)) return 'humanity'
  return subject
}

// ── 教学版式骨架（6 类基础结构占位，老师填空） ──
// 作为所有学段/学科的兜底默认骨架。
export const EDU_LAYOUT_SKELETONS: Record<Exclude<SlideLayout, 'title-body' | 'title-only' | 'two-col' | 'blank'>, LayoutSkeleton> = {
  'edu-cover': {
    hint: '封面：填写课题、年级学科与授课教师',
    placeholders: [
      { key: 'title', label: '课题名称', kind: 'title' },
      { key: 'info', label: '年级 / 学科 / 教师', kind: 'info-block' },
    ],
  },
  'edu-goal': {
    hint: '教学目标：按三维目标分栏填写',
    placeholders: [
      { key: 'knowledge', label: '知识与技能', kind: 'bullet' },
      { key: 'process', label: '过程与方法', kind: 'bullet' },
      { key: 'emotion', label: '情感态度价值观', kind: 'bullet' },
    ],
  },
  'edu-explain': {
    hint: '知识讲解：上方概念定义，下方要点展开',
    placeholders: [
      { key: 'definition', label: '概念定义', kind: 'body' },
      { key: 'points', label: '要点展开', kind: 'bullet' },
    ],
  },
  'edu-example': {
    hint: '例题演练：上方题干，下方解答步骤',
    placeholders: [
      { key: 'question', label: '题干', kind: 'body' },
      { key: 'solution', label: '解答步骤', kind: 'bullet' },
    ],
  },
  'edu-summary': {
    hint: '课堂小结：要点归纳 + 思维导图占位',
    placeholders: [
      { key: 'points', label: '要点归纳', kind: 'bullet' },
      { key: 'mindmap', label: '思维导图占位', kind: 'info-block' },
    ],
  },
  'edu-homework': {
    hint: '作业布置：分层作业（基础 / 提高 / 拓展）',
    placeholders: [
      { key: 'basic', label: '基础', kind: 'bullet' },
      { key: 'improve', label: '提高', kind: 'bullet' },
      { key: 'expand', label: '拓展', kind: 'bullet' },
    ],
  },
}

// ── 学段 × 学科 二维骨架索引（内置，教师无感） ──
// 结构差异点：小学低段图文并重/字号大占位；小学高段均衡；初中段加例题推导块；
// 高中段紧凑、强调推导链。同一套风格×色系面板，底层骨架随任教上下文自动变。
// 4 档学段 × 9 学科族（语文/数学/英语/科学/人文/艺术/体育/信息 + _default）全覆盖。
type EduSkeletons = Partial<Record<SlideLayout, LayoutSkeleton>>

const SK_LOW_BASE: EduSkeletons = {
  'edu-cover':   { hint: '封面：课题大字号，配年级学科教师信息块', placeholders: [{ key: 'title', label: '课题名称（大字号）', kind: 'title' }, { key: 'info', label: '年级 / 学科 / 教师', kind: 'info-block' }] },
  'edu-goal':    { hint: '教学目标：三维目标，配图示意', placeholders: [{ key: 'knowledge', label: '知识与技能', kind: 'bullet' }, { key: 'process', label: '过程与方法', kind: 'bullet' }, { key: 'emotion', label: '情感态度价值观', kind: 'bullet' }] },
  'edu-explain': { hint: '知识讲解：图文并重，概念+配图', placeholders: [{ key: 'definition', label: '概念定义', kind: 'body' }, { key: 'picture', label: '配图/示意图', kind: 'info-block' }, { key: 'points', label: '要点展开', kind: 'bullet' }] },
  'edu-example': { hint: '例题演练：题干大字 + 分步', placeholders: [{ key: 'question', label: '题干（大字号）', kind: 'body' }, { key: 'solution', label: '解答步骤', kind: 'bullet' }] },
  'edu-summary': { hint: '课堂小结：要点 + 趣味导图', placeholders: [{ key: 'points', label: '要点归纳', kind: 'bullet' }, { key: 'mindmap', label: '思维导图占位', kind: 'info-block' }] },
  'edu-homework':{ hint: '作业布置：分层（基础/提高/拓展）', placeholders: [{ key: 'basic', label: '基础', kind: 'bullet' }, { key: 'improve', label: '提高', kind: 'bullet' }, { key: 'expand', label: '拓展', kind: 'bullet' }] },
}
const SK_UP_BASE: EduSkeletons = {
  'edu-cover':   { hint: '封面：课题+年级学科教师信息块', placeholders: [{ key: 'title', label: '课题名称', kind: 'title' }, { key: 'info', label: '年级 / 学科 / 教师', kind: 'info-block' }] },
  'edu-goal':    { hint: '教学目标：三维目标分栏', placeholders: [{ key: 'knowledge', label: '知识与技能', kind: 'bullet' }, { key: 'process', label: '过程与方法', kind: 'bullet' }, { key: 'emotion', label: '情感态度价值观', kind: 'bullet' }] },
  'edu-explain': { hint: '知识讲解：概念定义 + 要点', placeholders: [{ key: 'definition', label: '概念定义', kind: 'body' }, { key: 'points', label: '要点展开', kind: 'bullet' }] },
  'edu-example': { hint: '例题演练：题干 + 解答步骤', placeholders: [{ key: 'question', label: '题干', kind: 'body' }, { key: 'solution', label: '解答步骤', kind: 'bullet' }] },
  'edu-summary': { hint: '课堂小结：要点归纳 + 导图', placeholders: [{ key: 'points', label: '要点归纳', kind: 'bullet' }, { key: 'mindmap', label: '思维导图占位', kind: 'info-block' }] },
  'edu-homework':{ hint: '作业布置：分层（基础/提高/拓展）', placeholders: [{ key: 'basic', label: '基础', kind: 'bullet' }, { key: 'improve', label: '提高', kind: 'bullet' }, { key: 'expand', label: '拓展', kind: 'bullet' }] },
}
const SK_MID_BASE: EduSkeletons = {
  'edu-cover':   { hint: '封面：课题+年级学科教师信息块', placeholders: [{ key: 'title', label: '课题名称', kind: 'title' }, { key: 'info', label: '年级 / 学科 / 教师', kind: 'info-block' }] },
  'edu-goal':    { hint: '教学目标：三维目标 + 考点对接', placeholders: [{ key: 'knowledge', label: '知识与技能', kind: 'bullet' }, { key: 'process', label: '过程与方法', kind: 'bullet' }, { key: 'emotion', label: '情感态度价值观', kind: 'bullet' }, { key: 'exam', label: '考点对接', kind: 'info-block' }] },
  'edu-explain': { hint: '知识讲解：定义 + 推导 + 要点', placeholders: [{ key: 'definition', label: '概念/公式', kind: 'body' }, { key: 'derive', label: '推导过程', kind: 'bullet' }, { key: 'points', label: '要点展开', kind: 'bullet' }] },
  'edu-example': { hint: '例题演练：题干 + 思路 + 解答', placeholders: [{ key: 'question', label: '题干', kind: 'body' }, { key: 'thinking', label: '解题思路', kind: 'bullet' }, { key: 'solution', label: '解答步骤', kind: 'bullet' }] },
  'edu-summary': { hint: '课堂小结：要点 + 知识网', placeholders: [{ key: 'points', label: '要点归纳', kind: 'bullet' }, { key: 'mindmap', label: '知识网络占位', kind: 'info-block' }] },
  'edu-homework':{ hint: '作业布置：分层（基础/提高/拓展/探究）', placeholders: [{ key: 'basic', label: '基础', kind: 'bullet' }, { key: 'improve', label: '提高', kind: 'bullet' }, { key: 'expand', label: '拓展', kind: 'bullet' }, { key: 'probe', label: '探究', kind: 'bullet' }] },
}
const SK_HIGH_BASE: EduSkeletons = {
  'edu-cover':   { hint: '封面：课题+年级学科教师信息块', placeholders: [{ key: 'title', label: '课题名称', kind: 'title' }, { key: 'info', label: '年级 / 学科 / 教师', kind: 'info-block' }] },
  'edu-goal':    { hint: '教学目标：素养目标 + 考点', placeholders: [{ key: 'literacy', label: '学科素养', kind: 'bullet' }, { key: 'exam', label: '考点对接', kind: 'info-block' }] },
  'edu-explain': { hint: '知识讲解：定理 + 推导链 + 变式', placeholders: [{ key: 'theorem', label: '定理/公式', kind: 'body' }, { key: 'derive', label: '推导链', kind: 'bullet' }, { key: 'variant', label: '变式要点', kind: 'bullet' }] },
  'edu-example': { hint: '例题演练：题干 + 多解 + 规范', placeholders: [{ key: 'question', label: '题干', kind: 'body' }, { key: 'solutions', label: '多解思路', kind: 'bullet' }, { key: 'standard', label: '规范解答', kind: 'bullet' }] },
  'edu-summary': { hint: '课堂小结：能力提炼 + 网络', placeholders: [{ key: 'points', label: '能力提炼', kind: 'bullet' }, { key: 'mindmap', label: '知识网络占位', kind: 'info-block' }] },
  'edu-homework':{ hint: '作业布置：分层（基础/综合/拔高）', placeholders: [{ key: 'basic', label: '基础', kind: 'bullet' }, { key: 'synthesis', label: '综合', kind: 'bullet' }, { key: 'advanced', label: '拔高', kind: 'bullet' }] },
}

// 学科微调：按学科族差异化讲解/例题/小结块；其余学段基础骨架复用。
// 仅语文/数学/英语/理科(物理化学生物)/人文(历史地理政治) 有专属结构，其余回落学段基础。
function withSubjectTweak(base: EduSkeletons, subject: string): EduSkeletons {
  const fam = subjectFamily(subject)
  if (subject === '语文') {
    return { ...base, 'edu-explain': { hint: '文本讲解：段落大意 + 赏析', placeholders: [{ key: 'paragraph', label: '段落大意', kind: 'body' }, { key: 'appreciate', label: '语言赏析', kind: 'bullet' }] } }
  }
  if (subject === '数学') {
    return { ...base, 'edu-explain': { hint: '知识讲解：公式 + 推导 + 应用', placeholders: [{ key: 'formula', label: '公式/定理', kind: 'body' }, { key: 'derive', label: '推导过程', kind: 'bullet' }, { key: 'apply', label: '应用举例', kind: 'bullet' }] } }
  }
  if (subject === '英语') {
    return { ...base, 'edu-explain': { hint: '情境讲解：句型 + 情境', placeholders: [{ key: 'pattern', label: '重点句型', kind: 'body' }, { key: 'scene', label: '情境示例', kind: 'info-block' }, { key: 'points', label: '要点展开', kind: 'bullet' }] } }
  }
  if (fam === 'science') {
    return {
      ...base,
      'edu-explain': { hint: '知识讲解：概念 + 原理', placeholders: [{ key: 'concept', label: '核心概念', kind: 'body' }, { key: 'principle', label: '科学原理', kind: 'bullet' }] },
      'edu-example': { hint: '实验/例题：步骤 + 现象', placeholders: [{ key: 'question', label: '问题/课题', kind: 'body' }, { key: 'steps', label: '实验步骤', kind: 'bullet' }, { key: 'phenomenon', label: '现象/结论', kind: 'bullet' }] },
    }
  }
  if (fam === 'humanity') {
    return { ...base, 'edu-explain': { hint: '知识讲解：脉络 + 史料', placeholders: [{ key: 'context', label: '时代背景', kind: 'body' }, { key: 'clue', label: '发展脉络', kind: 'bullet' }, { key: 'evidence', label: '史料/案例', kind: 'info-block' }] } }
  }
  return base
}

// 4 档学段 × 9 边界学科骨架（通过 subjectFamily 去重：理科/人文各共享一组）
export const STAGE_SKELETONS: Record<StageKey, Record<string, EduSkeletons>> = {
  lower:  { _default: SK_LOW_BASE,  语文: withSubjectTweak(SK_LOW_BASE, '语文'), 数学: withSubjectTweak(SK_LOW_BASE, '数学'), 英语: withSubjectTweak(SK_LOW_BASE, '英语'), science: withSubjectTweak(SK_LOW_BASE, 'science'), humanity: withSubjectTweak(SK_LOW_BASE, 'humanity') },
  upper:  { _default: SK_UP_BASE,   语文: withSubjectTweak(SK_UP_BASE, '语文'),  数学: withSubjectTweak(SK_UP_BASE, '数学'), 英语: withSubjectTweak(SK_UP_BASE, '英语'), science: withSubjectTweak(SK_UP_BASE, 'science'), humanity: withSubjectTweak(SK_UP_BASE, 'humanity') },
  middle: { _default: SK_MID_BASE,  语文: withSubjectTweak(SK_MID_BASE, '语文'), 数学: withSubjectTweak(SK_MID_BASE, '数学'), 英语: withSubjectTweak(SK_MID_BASE, '英语'), science: withSubjectTweak(SK_MID_BASE, 'science'), humanity: withSubjectTweak(SK_MID_BASE, 'humanity') },
  high:   { _default: SK_HIGH_BASE, 语文: withSubjectTweak(SK_HIGH_BASE, '语文'), 数学: withSubjectTweak(SK_HIGH_BASE, '数学'), 英语: withSubjectTweak(SK_HIGH_BASE, '英语'), science: withSubjectTweak(SK_HIGH_BASE, 'science'), humanity: withSubjectTweak(SK_HIGH_BASE, 'humanity') },
}

// 取某学段+学科的真实骨架（内置索引，逐级回落：学科专属 → 学段默认 → 全局基础骨架）
export function skeletonFor(stage: StageKey, subject: string): EduSkeletons {
  const stageMap = STAGE_SKELETONS[stage]
  return stageMap[subjectKey(subject)] ?? stageMap._default ?? (EDU_LAYOUT_SKELETONS as EduSkeletons)
}

// ── 模板对象：配色 + 版式骨架 打包成一套可套用对象 ──
export interface CwTemplate {
  id: string
  kind: TemplateKind
  name: string
  style: StyleTag
  themeId: string                                   // 复用现有 CwTheme 配色
  layouts: Partial<Record<SlideLayout, LayoutSkeleton>> // 该模板提供的版式骨架（默认用 edu-* 教学版式）
  subjects?: string[]                               // 适配学科（空=通用）
  grades?: ('小学' | '初中' | '高中')[]             // 适配学段
  cover?: string                                    // 封面缩微图（dataURL/SVG）；留空则由 renderTemplateThumb 自动生成
  demoOutline?: OutlineSlide[]                      // 示例提纲：空课件套用时注入，立即可见版式预览（教师填空式替换）
}

// ── PPT 模板池：基于现有 56 套 CwTheme 配色铺满 8 类风格（各标签下素材积累多少算多少） ──
// themeId 全部复用 pptThemes.ts 真实存在的 CwTheme；名称取「主题名·风格课件」形式，所见即所得。
import { getTheme } from './pptThemes'
import type { OutlineSlide } from './exportPptx'

// 教学通用示例提纲：空课件套模板时注入，立即可见版式预览（教师填空式替换）
function eduDemoOutline(): OutlineSlide[] {
  return [
    { title: '封面', bullets: ['《课程标题》', '学科 · 年级 · 班级', '授课教师：XXX'], layout: 'edu-cover', notes: '' },
    { title: '学习目标', bullets: ['知识点一：能理解并表述', '知识点二：能运用解决', '核心素养：培养探究能力'], layout: 'edu-goal', notes: '' },
    { title: '情境导入', bullets: ['生活/旧知情境引出问题', '激发兴趣、明确学习任务'], layout: 'title-body', notes: '' },
    { title: '新知讲解', bullets: ['核心概念与原理', '关键步骤与要点', '易错点提示'], layout: 'edu-explain', notes: '' },
    { title: '例题精讲', bullets: ['典型例题呈现', '思路分析 + 分步解答', '方法归纳'], layout: 'edu-example', notes: '' },
    { title: '课堂小结', bullets: ['本节课核心收获', '知识结构梳理'], layout: 'edu-summary', notes: '' },
    { title: '课后作业', bullets: ['基础巩固练习', '拓展提升任务'], layout: 'edu-homework', notes: '' },
  ]
}

function pptTemplate(
  id: string,
  name: string,
  style: StyleTag,
  themeId: string,
  subjects?: string[],
  grades?: ('小学' | '初中' | '高中')[],
  kind: TemplateKind = 'ppt',
): CwTemplate {
  return {
    id,
    kind,
    name,
    style,
    themeId,
    // 每套模板都自带同一套教学版式骨架（结构占位通用，配色由 themeId 决定）
    layouts: { ...EDU_LAYOUT_SKELETONS },
    subjects,
    grades,
    demoOutline: eduDemoOutline(),
  }
}

// 风格标签 → 该风格下选用的 themeId 列表（均来自 pptThemes.ts 真实配色）
const PPT_STYLE_THEMES: Record<StyleTag, string[]> = {
  basic: ['min-classic-blue', 'min-pure-white', 'aca-edu-blue'],
  china: ['zgf-ink-wash', 'zgf-guochao', 'zgf-shanshui', 'zgf-song-qing'],
  minimal: ['min-classic-blue', 'min-geo', 'min-gray-premium', 'min-pure-white', 'min-modern-line', 'min-navy-intellectual'],
  tech: ['te-quantum-blue', 'te-tech-navy', 'te-cyber-purple', 'te-aurora-green', 'te-digital-cyan'],
  fresh: ['fr-mint', 'fr-sky-blue', 'fr-warm-orange', 'fr-macaron-pink', 'fr-sakura'],
  academic: ['aca-edu-blue', 'aca-rational', 'aca-deep-green', 'aca-cream'],
  cartoon: ['sp-cartoon', 'sp-doodle'],
  flat: ['mo-haze-blue', 'mo-gray-purple', 'mo-bean-green'],
  business: ['min-navy-intellectual', 'gr-blue-purple', 'wa-elegant-purple'],
}

// H5 互动课件风格分布：偏向亮色/跳色（投屏平板更出彩），卡通/清新权重更高，沉稳/严谨权重更低。
// 与 PPT 共用同一套风格标签与配色，仅素材比例倾斜；规则体系完全一致。
const H5_STYLE_THEMES: Record<StyleTag, string[]> = {
  basic: ['min-classic-blue', 'min-pure-white', 'aca-edu-blue'],
  china: ['zgf-guochao', 'zgf-shanshui', 'zgf-song-qing'],
  minimal: ['min-pure-white', 'min-modern-line', 'min-navy-intellectual'],
  tech: ['te-quantum-blue', 'te-aurora-green', 'te-digital-cyan'],
  fresh: ['fr-mint', 'fr-sky-blue', 'fr-warm-orange', 'fr-macaron-pink', 'fr-sakura', 'fr-lemon'],
  academic: ['aca-edu-blue', 'aca-deep-green'],
  cartoon: ['sp-cartoon', 'sp-doodle', 'sp-party-red', 'sp-festive'],
  flat: ['mo-haze-blue', 'mo-gray-purple', 'mo-bean-green', 'mo-rose-gray'],
  business: ['gr-blue-purple', 'wa-elegant-purple'],
}

// 风格 → 默认落地配色（AI 生成风格时用于自动套用；取该风格下首个 themeId）
export function defaultThemeForStyle(style: StyleTag): string {
  return PPT_STYLE_THEMES[style]?.[0] || 'min-classic-blue'
}

function buildTemplates(kind: TemplateKind, styleThemes: Record<StyleTag, string[]>): CwTemplate[] {
  const out: CwTemplate[] = []
  let n = 0
  ;(Object.keys(styleThemes) as StyleTag[]).forEach((style) => {
    styleThemes[style].forEach((themeId) => {
      const th = getTheme(themeId)
      n += 1
      out.push(
        pptTemplate(
          `${kind}-${style}-${n}`,
          `${th.name}·${STYLE_LABELS[style]}课件`,
          style,
          themeId,
          th.subjects && th.subjects.length ? th.subjects : undefined,
          th.grades && th.grades.length
            ? (th.grades.map((g) => (g === 'low' ? '小学' : g === 'mid' ? '初中' : '高中')) as ('小学' | '初中' | '高中')[])
            : undefined,
          kind,
        ),
      )
    })
  })
  return out
}

export const PPT_TEMPLATES: CwTemplate[] = buildTemplates('ppt', PPT_STYLE_THEMES)
export const H5_TEMPLATES: CwTemplate[] = buildTemplates('h5', H5_STYLE_THEMES)

// 按媒介取模板池
export function getTemplatesByKind(kind: TemplateKind): CwTemplate[] {
  return kind === 'ppt' ? PPT_TEMPLATES : H5_TEMPLATES
}

// 按媒介 + 风格筛选（风格标签跨媒介统一，素材池各自分流）
export function getTemplates(kind: TemplateKind, style?: StyleTag): CwTemplate[] {
  const pool = getTemplatesByKind(kind)
  return style ? pool.filter((t) => t.style === style) : pool
}

// 取某模板在某版式下的骨架（无则返回 undefined，调用方回退默认版式）
export function getLayoutSkeleton(tpl: CwTemplate, layout: SlideLayout): LayoutSkeleton | undefined {
  return tpl.layouts[layout]
}

// ── 套用引擎：从模板库选 → 一键换肤套用、内容不变、可撤销 ──
// 只要模板提供该教学版式骨架，就按"页序/语义"自动分配版式；否则保留原 layout。
// ctx 提供学段/学科时，骨架按二维索引解析（结构随任教上下文自动变，教师无感）。
// 返回 { outline, themeId, prevThemeId, prevLayouts } 供调用方 setState + 撤销。

export interface ApplyResult {
  outline: OutlineSlide[]
  themeId: string
  prevThemeId: string
  prevLayouts: (string | undefined)[]
}

export interface ApplyContext {
  stage?: StageKey
  subject?: string
}

// 根据页标题/内容推断教学版式（仅在模板提供该版式骨架时生效）
function inferEduLayout(slide: OutlineSlide, layouts: EduSkeletons): SlideLayout | undefined {
  const text = `${slide.title || ''} ${(slide.bullets || []).join(' ')}`.toLowerCase()
  const has = (...kw: string[]) => kw.some((k) => text.includes(k))
  const pick = (...order: SlideLayout[]): SlideLayout | undefined =>
    order.find((l) => layouts[l])
  if (has('封面', 'cover')) return pick('edu-cover')
  if (has('目标', 'goal')) return pick('edu-goal')
  if (has('例题', '演练', 'example')) return pick('edu-example')
  if (has('小结', '总结', 'summary')) return pick('edu-summary')
  if (has('作业', '练习', 'homework', '分层')) return pick('edu-homework')
  if (has('讲解', '概念', '知识', 'explain')) return pick('edu-explain')
  return undefined
}

export function applyTemplate(
  outline: OutlineSlide[],
  tpl: CwTemplate,
  curThemeId: string,
  ctx?: ApplyContext,
): ApplyResult {
  // 空课件套用模板：注入模板自带的示例提纲，立即可见版式预览（填空式替换）
  if (outline.length === 0 && tpl.demoOutline && tpl.demoOutline.length) {
    outline = tpl.demoOutline
  }
  // 解析真实骨架：有 ctx 走二维索引，否则用模板自带 layouts
  const layouts: EduSkeletons = ctx?.stage
    ? skeletonFor(ctx.stage, ctx.subject ?? '')
    : (tpl.layouts as EduSkeletons)
  const prevLayouts = outline.map((s) => s.layout)
  const next = outline.map((s) => {
    const inferred = inferEduLayout(s, layouts)
    // 仅当骨架提供该版式时才套用，否则保留原 layout
    const layout = inferred ? inferred : s.layout
    return { ...s, layout }
  })
  return {
    outline: next,
    themeId: tpl.themeId,
    prevThemeId: curThemeId,
    prevLayouts,
  }
}

// 撤销套用（恢复 themeId + 各页 layout；内容未变，直接还原）
export function revertTemplate(
  outline: OutlineSlide[],
  prevThemeId: string,
  prevLayouts: (string | undefined)[],
): { outline: OutlineSlide[]; themeId: string } {
  const reverted = outline.map((s, i) => ({ ...s, layout: prevLayouts[i] }))
  return { outline: reverted, themeId: prevThemeId }
}

// ── 封面缩微图：用真实配色实时渲染"多页版式示意"SVG（零外部图片依赖、所见即所得） ──
// 不抓任何第三方站点图片（版权 + 格式不兼容），缩微图完全由本模板的 themeId 派生。
// 改为"三页缩微服务"：封面 / 两栏讲解 / 要点列表，直观体现版式结构差异，而非只有色系。
const THUMB_PAGES: { kind: 'cover' | 'twocol' | 'bullets' }[] = [
  { kind: 'cover' },
  { kind: 'twocol' },
  { kind: 'bullets' },
]
export function renderTemplateThumb(tpl: CwTemplate): string {
  if (tpl.cover) return tpl.cover
  const th = getTheme(tpl.themeId)
  const W = 160, H = 90
  const bg = svgColor(th.coverBg, '#FFFFFF')
  const primary = svgColor(th.primary, '#1A3A6B')
  const onPrimary = svgColor(th.onPrimary, '#FFFFFF')
  const subtle = svgColor(th.subtle, '#E7E7EB')
  const text = svgColor(th.body, '#333333')
  const footer = svgColor(th.footer, primary)

  // 三张微缩页并排，呈现"封面→两栏→要点"的版式节奏
  const pw = 42, gap = 5, startX = 8, topY = 14, ph = 58
  const pages = THUMB_PAGES.map((p, i) => {
    const x = startX + i * (pw + gap)
    let body = ''
    if (p.kind === 'cover') {
      body = `<rect x="${x + pw / 2 - 12}" y="${topY + 14}" width="24" height="5" rx="2.5" fill="${primary}"/>`
        + `<rect x="${x + 8}" y="${topY + 26}" width="${pw - 16}" height="3" rx="1.5" fill="${subtle}"/>`
        + `<rect x="${x + 12}" y="${topY + 33}" width="${pw - 24}" height="3" rx="1.5" fill="${subtle}"/>`
    } else if (p.kind === 'twocol') {
      body = `<rect x="${x + 4}" y="${topY + 6}" width="${pw / 2 - 7}" height="${ph - 12}" rx="2" fill="${subtle}"/>`
        + `<rect x="${x + pw / 2 + 3}" y="${topY + 6}" width="${pw / 2 - 7}" height="${ph - 12}" rx="2" fill="${subtle}"/>`
        + `<rect x="${x + 4}" y="${topY + 11}" width="${pw / 2 - 12}" height="3" rx="1.5" fill="${primary}" opacity="0.5"/>`
    } else {
      body = [0.18, 0.40, 0.62, 0.84].map((r) =>
        `<rect x="${x + 4}" y="${topY + ph * r}" width="${pw - 8}" height="3.4" rx="1.7" fill="${subtle}"/>`).join('')
    }
    return `<g><rect x="${x}" y="${topY}" width="${pw}" height="${ph}" rx="3" fill="#FFFFFF" stroke="${subtle}" stroke-width="1"/>${body}</g>`
  }).join('')

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs><clipPath id="r"><rect width="${W}" height="${H}" rx="6"/></clipPath></defs>
    <g clip-path="url(#r)">
      <rect width="${W}" height="${H}" fill="${bg}"/>
      <rect x="0" y="0" width="${W}" height="11" fill="${primary}"/>
      <text x="8" y="8" font-family="${th.font || 'sans-serif'}" font-size="7" font-weight="700" fill="${onPrimary}">${escapeXml(tpl.name.slice(0, 14))}</text>
      ${pages}
      <rect x="${startX}" y="${topY + ph + 5}" width="${pw * 3 + gap * 2}" height="3" rx="1.5" fill="${footer}" opacity="0.5"/>
    </g>
  </svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c] as string))
}

/** SVG fill 颜色规范化：theme 库中 hex 不带 #，SVG 属性必须带 #，否则 Chrome 会回退成黑色 */
function svgColor(c?: string, fallback = '#CCCCCC'): string {
  if (!c) return fallback
  if (c.startsWith('#')) return c
  if (c.startsWith('linear-gradient') || c.startsWith('rgb') || c.startsWith('hsl')) return fallback
  return '#' + c
}

// ── 「通用」结构模板：不绑固定配色，仅提供一套百搭版式骨架 ──
// 套用时由调用方传入色系代表配色（applyTemplate 复用现有主题），实现"结构 × 色系"自由组合。
// kind 可指定 ppt / h5（两套媒介共用同一套结构骨架，仅媒介标记不同）。
export function makeBasicTemplate(kind: TemplateKind = 'ppt'): CwTemplate {
  return {
    id: `basic-${kind}`,
    kind,
    name: '通用结构',
    style: 'basic',
    themeId: 'min-classic-blue', // 占位，实际套用由色系覆盖
    layouts: { ...EDU_LAYOUT_SKELETONS },
    demoOutline: eduDemoOutline(),
  }
}

export const BASIC_TEMPLATE: CwTemplate = makeBasicTemplate('ppt')

// 由色系生成一张「通用结构 + 该色系」的临时模板（供 applyTemplate 用）
export function basicTemplateForFamily(family: ColorFamily, kind: TemplateKind = 'ppt'): CwTemplate {
  const base = makeBasicTemplate(kind)
  return { ...base, id: `basic-${family.id}-${kind}`, name: `通用·${family.label}`, themeId: family.themeId }
}

// 色系缩微图（色卡 + 结构示意，不依赖具体主题名）
export function renderFamilyThumb(family: ColorFamily): string {
  const W = 160, H = 90
  const sw = svgColor(family.swatch, '#1A3A6B')
  const bars = [0.42, 0.56, 0.70].map((y) =>
    `<rect x="14" y="${H * y}" width="92" height="5" rx="2.5" fill="${sw}" opacity="0.35"/>`
  ).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs><clipPath id="r"><rect width="${W}" height="${H}" rx="6"/></clipPath></defs>
    <g clip-path="url(#r)">
      <rect width="${W}" height="${H}" fill="#FFFFFF"/>
      <rect x="0" y="0" width="${W}" height="22" fill="${sw}"/>
      <text x="14" y="15" font-family="sans-serif" font-size="10" font-weight="700" fill="#FFFFFF">通用 · ${escapeXml(family.label)}</text>
      <rect x="14" y="32" width="60" height="9" rx="4" fill="${sw}"/>
      ${bars}
      <rect x="116" y="64" width="30" height="14" rx="3" fill="${sw}" opacity="0.85"/>
    </g>
  </svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
