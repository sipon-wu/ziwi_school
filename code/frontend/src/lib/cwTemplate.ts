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

import type { DecorSlots, DecorItem } from './api'
import { resolveDecorUrl } from './decorCatalog'

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
  // ── 通用版式（本期新增，PPT/H5 共用）──
  | 'cover'        // 封面
  | 'toc'          // 目录
  | 'section'      // 分隔页
  | 'content-1col' // 单栏内容
  | 'content-2col' // 双栏内容
  | 'content-3col' // 三栏内容
  | 'content-4col' // 四栏内容
  | 'content-grid' // 网格内容（2-6项自适应）
  | 'summary'      // 总结页
  | 'comparison'   // 对比页
  | 'timeline'     // 时间线页
  | 'chart'        // 图表页
  | 'image-text'   // 图文混排
  | 'image-full'   // 全屏图片

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
  'cover': '封面',
  'toc': '目录',
  'section': '分隔页',
  'content-1col': '单栏内容',
  'content-2col': '双栏内容',
  'content-3col': '三栏内容',
  'content-4col': '四栏内容',
  'content-grid': '网格内容',
  'summary': '总结页',
  'comparison': '对比页',
  'timeline': '时间线页',
  'chart': '图表页',
  'image-text': '图文混排',
  'image-full': '全屏图片',
}

// 自适应：content-* 系列按内容条目数选最优版式（1+2→1+3 等自动扩展/降级）。
// 仅在 content-* 系列内联动，不跨教学骨架；与现有 distributeToSlots 溢出逻辑复用。
export function pickContentLayout(itemCount: number): SlideLayout {
  if (itemCount <= 1) return 'content-1col'
  if (itemCount === 2) return 'content-2col'
  if (itemCount === 3) return 'content-3col'
  if (itemCount === 4) return 'content-4col'
  return 'content-grid' // 5-6 项网格
}

// 通用版式 key 集合（非 edu-* 前缀即通用版式，PPT/H5 共用）
export const GENERIC_LAYOUTS: SlideLayout[] = [
  'cover', 'toc', 'section', 'content-1col', 'content-2col', 'content-3col',
  'content-4col', 'content-grid', 'summary', 'comparison', 'timeline', 'chart',
  'image-text', 'image-full',
]

// 占位区块的类型
export type PlaceholderKind = 'title' | 'body' | 'bullet' | 'info-block'

// 占位区块几何（画布百分比坐标，x/y/w/h 均为 0~100）
// 这是「内容与模板分离」的物理契约：相同 key 在不同版式下位置不同，
// 渲染/导出/编辑三端共用同一份 rect，换模板即换这套 rect。
export interface PlaceholderRect {
  x: number
  y: number
  w: number
  h: number
}

export interface Placeholder {
  key: string
  label: string
  kind: PlaceholderKind
  // 几何坐标（画布百分比）。默认骨架 EDU_LAYOUT_SKELETONS 必填；
  // 学段/学科骨架可省略，由 skeletonFor 从默认骨架 merge 补入。
  rect?: PlaceholderRect
  // bullets 类多列布局（如三维目标、分层作业三列）；其余忽略
  columns?: number
  // 可选文本样式默认值（仅结构建议，导出/渲染可覆盖）
  fontSize?: number
  bold?: boolean
  align?: 'left' | 'center' | 'right'
  // 占位提示文案（无内容时显示，如「题干（填写）」）
  placeholder?: string
}

// 单版式的骨架定义（结构占位，无业务内容）
export interface LayoutSkeleton {
  hint?: string
  placeholders: Placeholder[]
  // ★ 该版式专属装饰（模板内置装饰：随模板加载进画布，可在编辑器个性替换）。
  // 引用素材库装饰元件（assetId+version 引用 + snapshot 快照兜底），非独立资产。
  decor?: DecorSlot[]
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

// 年级数字 → 模板 facet 用 StageTag（primary/junior/senior/college 对老师更直观）
export function gradeToStageTag(grade: number): StageTag {
  if (grade <= 0) return 'kindergarten'
  if (grade <= 6) return 'primary'
  if (grade <= 9) return 'junior'
  if (grade <= 12) return 'senior'
  return 'college'
}

// 中文科目名 → 模板 facet 用 SubjectTag（AI 推荐接入时把 teaching.subject 映射到模板库标签）
const SUBJECT_TO_TAG: Record<string, SubjectTag> = {
  语文: 'chinese', 数学: 'math', 英语: 'english', 物理: 'physics', 化学: 'chemistry',
  生物: 'biology', 历史: 'history', 地理: 'geography', 政治: 'politics', 科学: 'science',
  美术: 'art', 体育: 'pe', 信息: 'it', 信息技术: 'it',
}
export function subjectToTag(subject: string): SubjectTag | undefined {
  return SUBJECT_TO_TAG[subject]
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
// 几何坐标约定（画布百分比，与现有 renderLayoutContent / layoutElements 保持一致）：
// 顶部标题窄条 y≈4~14，正文区 y≈20~88，三列卡片宽≈28~29、起步 x≈5.3 等距。
export const EDU_LAYOUT_SKELETONS: Record<Exclude<SlideLayout, 'title-body' | 'title-only' | 'two-col' | 'blank'>, LayoutSkeleton> = {
  'edu-cover': {
    hint: '封面：填写课题、年级学科与授课教师',
    placeholders: [
      { key: 'title', label: '课题名称', kind: 'title', rect: { x: 6, y: 30, w: 88, h: 14 }, fontSize: 36, bold: true, align: 'center', placeholder: '课题名称（填写）' },
      { key: 'info', label: '年级 / 学科 / 教师', kind: 'info-block', rect: { x: 6, y: 48, w: 88, h: 12 }, fontSize: 18, align: 'center', placeholder: '年级 / 学科 / 授课教师' },
    ],
  },
  'edu-goal': {
    hint: '教学目标：按三维目标分栏填写',
    placeholders: [
      { key: 'knowledge', label: '知识与技能', kind: 'bullet', rect: { x: 5.3, y: 22, w: 29, h: 60 }, columns: 1, placeholder: '知识与技能' },
      { key: 'process', label: '过程与方法', kind: 'bullet', rect: { x: 35.3, y: 22, w: 29, h: 60 }, columns: 1, placeholder: '过程与方法' },
      { key: 'emotion', label: '情感态度价值观', kind: 'bullet', rect: { x: 65.3, y: 22, w: 29, h: 60 }, columns: 1, placeholder: '情感态度价值观' },
    ],
  },
  'edu-explain': {
    hint: '知识讲解：上方概念定义，下方要点展开',
    placeholders: [
      { key: 'definition', label: '概念定义', kind: 'body', rect: { x: 6, y: 20, w: 88, h: 18 }, fontSize: 18, placeholder: '概念定义（填写）' },
      { key: 'points', label: '要点展开', kind: 'bullet', rect: { x: 6, y: 42, w: 88, h: 48 }, placeholder: '要点展开' },
    ],
  },
  'edu-example': {
    hint: '例题演练：上方题干，下方解答步骤',
    placeholders: [
      { key: 'question', label: '题干', kind: 'body', rect: { x: 6.3, y: 20, w: 87.4, h: 18 }, fontSize: 18, bold: true, placeholder: '题干（填写）' },
      { key: 'solution', label: '解答步骤', kind: 'bullet', rect: { x: 5.3, y: 44, w: 89.4, h: 40 }, columns: 3, placeholder: '解答步骤' },
    ],
  },
  'edu-summary': {
    hint: '课堂小结：要点归纳 + 思维导图占位',
    placeholders: [
      { key: 'points', label: '要点归纳', kind: 'bullet', rect: { x: 6, y: 20, w: 88, h: 44 }, placeholder: '要点归纳' },
      { key: 'mindmap', label: '思维导图占位', kind: 'info-block', rect: { x: 6, y: 68, w: 88, h: 22 }, placeholder: '思维导图占位' },
    ],
  },
  'edu-homework': {
    hint: '作业布置：分层作业（基础 / 提高 / 拓展）',
    placeholders: [
      { key: 'basic', label: '基础', kind: 'bullet', rect: { x: 5.3, y: 22, w: 29, h: 60 }, columns: 1, placeholder: '基础' },
      { key: 'improve', label: '提高', kind: 'bullet', rect: { x: 35.3, y: 22, w: 29, h: 60 }, columns: 1, placeholder: '提高' },
      { key: 'expand', label: '拓展', kind: 'bullet', rect: { x: 65.3, y: 22, w: 29, h: 60 }, columns: 1, placeholder: '拓展' },
    ],
  },

  // ── 通用版式（本期新增，PPT/H5 共用；几何为内容/布局分离的物理契约）──
  'cover': {
    hint: '封面：标题 + 副标题 + 信息',
    placeholders: [
      { key: 'title', label: '标题', kind: 'title', rect: { x: 8, y: 32, w: 84, h: 16 }, fontSize: 36, bold: true, align: 'center', placeholder: '标题（填写）' },
      { key: 'subtitle', label: '副标题', kind: 'body', rect: { x: 8, y: 50, w: 84, h: 10 }, fontSize: 18, align: 'center', placeholder: '副标题' },
      { key: 'info', label: '信息', kind: 'info-block', rect: { x: 8, y: 62, w: 84, h: 8 }, fontSize: 14, align: 'center', placeholder: '学科 / 年级 / 作者' },
    ],
  },
  'toc': {
    hint: '目录：标题 + 目录项（≤6）',
    placeholders: [
      { key: 'title', label: '目录标题', kind: 'title', rect: { x: 8, y: 12, w: 84, h: 10 }, fontSize: 24, bold: true, placeholder: '目录' },
      { key: 'items', label: '目录项', kind: 'bullet', rect: { x: 14, y: 30, w: 72, h: 56 }, columns: 1, placeholder: '目录项' },
    ],
  },
  'section': {
    hint: '分隔页：章节标题',
    placeholders: [
      { key: 'title', label: '章节标题', kind: 'title', rect: { x: 10, y: 42, w: 80, h: 16 }, fontSize: 32, bold: true, align: 'center', placeholder: '章节标题' },
    ],
  },
  'content-1col': {
    hint: '单栏内容页',
    placeholders: [
      { key: 'title', label: '标题', kind: 'title', rect: { x: 6.3, y: 12, w: 87.4, h: 10 }, fontSize: 24, bold: true, placeholder: '标题' },
      { key: 'body', label: '内容', kind: 'bullet', rect: { x: 6.3, y: 28, w: 87.4, h: 60 }, columns: 1, placeholder: '内容要点' },
    ],
  },
  'content-2col': {
    hint: '双栏内容页',
    placeholders: [
      { key: 'title', label: '标题', kind: 'title', rect: { x: 6.3, y: 12, w: 87.4, h: 10 }, fontSize: 24, bold: true, placeholder: '标题' },
      { key: 'left', label: '左栏', kind: 'bullet', rect: { x: 6.3, y: 28, w: 43, h: 60 }, columns: 1, placeholder: '左栏内容' },
      { key: 'right', label: '右栏', kind: 'bullet', rect: { x: 50.7, y: 28, w: 43, h: 60 }, columns: 1, placeholder: '右栏内容' },
    ],
  },
  'content-3col': {
    hint: '三栏内容页',
    placeholders: [
      { key: 'title', label: '标题', kind: 'title', rect: { x: 6.3, y: 12, w: 87.4, h: 10 }, fontSize: 24, bold: true, placeholder: '标题' },
      { key: 'col1', label: '栏1', kind: 'bullet', rect: { x: 6.3, y: 28, w: 28, h: 60 }, columns: 1, placeholder: '栏1' },
      { key: 'col2', label: '栏2', kind: 'bullet', rect: { x: 36.2, y: 28, w: 28, h: 60 }, columns: 1, placeholder: '栏2' },
      { key: 'col3', label: '栏3', kind: 'bullet', rect: { x: 66.1, y: 28, w: 28, h: 60 }, columns: 1, placeholder: '栏3' },
    ],
  },
  'content-4col': {
    hint: '四栏内容页',
    placeholders: [
      { key: 'title', label: '标题', kind: 'title', rect: { x: 6.3, y: 12, w: 87.4, h: 10 }, fontSize: 24, bold: true, placeholder: '标题' },
      { key: 'col1', label: '栏1', kind: 'bullet', rect: { x: 6.3, y: 28, w: 20.5, h: 60 }, columns: 1, placeholder: '栏1' },
      { key: 'col2', label: '栏2', kind: 'bullet', rect: { x: 29.2, y: 28, w: 20.5, h: 60 }, columns: 1, placeholder: '栏2' },
      { key: 'col3', label: '栏3', kind: 'bullet', rect: { x: 52.1, y: 28, w: 20.5, h: 60 }, columns: 1, placeholder: '栏3' },
      { key: 'col4', label: '栏4', kind: 'bullet', rect: { x: 75, y: 28, w: 20.5, h: 60 }, columns: 1, placeholder: '栏4' },
    ],
  },
  'content-grid': {
    hint: '网格内容页（2-6项自适应列数）',
    placeholders: [
      { key: 'title', label: '标题', kind: 'title', rect: { x: 6.3, y: 12, w: 87.4, h: 10 }, fontSize: 24, bold: true, placeholder: '标题' },
      { key: 'items', label: '网格项', kind: 'bullet', rect: { x: 6.3, y: 28, w: 87.4, h: 60 }, columns: 3, placeholder: '网格项' },
    ],
  },
  'summary': {
    hint: '总结页：标题 + 要点（≤6）',
    placeholders: [
      { key: 'title', label: '总结标题', kind: 'title', rect: { x: 6.3, y: 12, w: 87.4, h: 10 }, fontSize: 24, bold: true, placeholder: '课堂小结' },
      { key: 'items', label: '要点', kind: 'bullet', rect: { x: 6.3, y: 28, w: 87.4, h: 60 }, columns: 2, placeholder: '要点' },
    ],
  },
  'comparison': {
    hint: '对比页：左右两栏',
    placeholders: [
      { key: 'title', label: '对比标题', kind: 'title', rect: { x: 6.3, y: 12, w: 87.4, h: 10 }, fontSize: 24, bold: true, placeholder: '对比' },
      { key: 'left', label: '左侧', kind: 'bullet', rect: { x: 6.3, y: 28, w: 43, h: 60 }, columns: 1, placeholder: '左侧' },
      { key: 'right', label: '右侧', kind: 'bullet', rect: { x: 50.7, y: 28, w: 43, h: 60 }, columns: 1, placeholder: '右侧' },
    ],
  },
  'timeline': {
    hint: '时间线页：事件序列（≤6）',
    placeholders: [
      { key: 'title', label: '时间线标题', kind: 'title', rect: { x: 6.3, y: 12, w: 87.4, h: 10 }, fontSize: 24, bold: true, placeholder: '时间线' },
      { key: 'events', label: '事件', kind: 'bullet', rect: { x: 6.3, y: 30, w: 87.4, h: 56 }, columns: 1, placeholder: '事件节点' },
    ],
  },
  'chart': {
    hint: '图表页：标题 + 数据/说明占位',
    placeholders: [
      { key: 'title', label: '图表标题', kind: 'title', rect: { x: 6.3, y: 12, w: 87.4, h: 10 }, fontSize: 24, bold: true, placeholder: '图表标题' },
      { key: 'data', label: '图表数据/说明', kind: 'body', rect: { x: 6.3, y: 28, w: 87.4, h: 60 }, fontSize: 16, placeholder: '图表数据或说明' },
    ],
  },
  'image-text': {
    hint: '图文混排：图片 + 文字',
    placeholders: [
      { key: 'title', label: '标题', kind: 'title', rect: { x: 6.3, y: 12, w: 87.4, h: 10 }, fontSize: 24, bold: true, placeholder: '标题' },
      { key: 'image', label: '图片', kind: 'info-block', rect: { x: 6.3, y: 28, w: 43, h: 58 }, placeholder: '图片占位' },
      { key: 'body', label: '文字', kind: 'bullet', rect: { x: 50.7, y: 28, w: 43, h: 58 }, columns: 1, placeholder: '文字说明' },
    ],
  },
  'image-full': {
    hint: '全屏图片：图片 + 图注',
    placeholders: [
      { key: 'image', label: '全屏图片', kind: 'info-block', rect: { x: 6.3, y: 16, w: 87.4, h: 68 }, placeholder: '全屏图片' },
      { key: 'caption', label: '图注', kind: 'body', rect: { x: 6.3, y: 86, w: 87.4, h: 8 }, fontSize: 14, align: 'center', placeholder: '图注' },
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
// 返回前把「几何真相源」EDU_LAYOUT_SKELETONS 的 rect/columns/样式 merge 进学段骨架的 placeholder，
// 保证任何版式都有完整几何，渲染/导出/编辑三端共用同一份 rect。
export function skeletonFor(stage: StageKey, subject: string): EduSkeletons {
  const stageMap = STAGE_SKELETONS[stage]
  const base = stageMap[subjectKey(subject)] ?? stageMap._default ?? (EDU_LAYOUT_SKELETONS as EduSkeletons)
  const merged: EduSkeletons = {}
  for (const layout of Object.keys(base) as SlideLayout[]) {
    const sk = base[layout]
    const geo = EDU_LAYOUT_SKELETONS[layout as keyof typeof EDU_LAYOUT_SKELETONS]
    merged[layout] = {
      hint: sk?.hint ?? geo?.hint,
      placeholders: (sk?.placeholders ?? geo?.placeholders ?? []).map((p) => {
        const g = geo?.placeholders.find((x) => x.key === p.key)
        return g ? { ...g, ...p, rect: g.rect } : p
      }),
    }
  }
  return merged
}

// ── 内容与模板分离：全局唯一契约层 ──
// 取某 layout 的最终骨架（优先模板自带 layouts，回落到学段+学科索引骨架）。
// 任意一处渲染/导出/编辑都通过本函数拿到带几何的骨架，保证三端一致。
export function getSkeleton(
  layout: SlideLayout,
  opts?: { tplLayouts?: Partial<Record<SlideLayout, LayoutSkeleton>>; stage?: StageKey; subject?: string },
): LayoutSkeleton | undefined {
  if (opts?.tplLayouts && opts.tplLayouts[layout]) return opts.tplLayouts[layout]
  const sk = (skeletonFor(opts?.stage ?? 'upper', opts?.subject ?? '_default') as EduSkeletons)[layout]
  if (sk) return sk
  // 通用版式（cover/toc/content-* 等）回落到 EDU_LAYOUT_SKELETONS 全局几何真相源
  return (EDU_LAYOUT_SKELETONS as EduSkeletons)[layout]
}

// 判断某 layout 是否为「结构化版式」（有骨架占位、走内容与模板分离渲染）。
// 纯排版版式（title-body/title-only/two-col/blank）走扁平 bullets 默认渲染，不在此列。
const PLAIN_LAYOUTS: SlideLayout[] = ['title-body', 'title-only', 'two-col', 'blank']
export function isStructuredLayout(layout?: string): layout is SlideLayout {
  if (!layout) return false
  if (PLAIN_LAYOUTS.includes(layout as SlideLayout)) return false
  return !!getSkeleton(layout as SlideLayout)
}

// 将一页的扁平 bullets 按骨架的 placeholder 顺序分发进 slots。
// 规则：title 占位接首条；bullet 占位按列数等分剩余；其它占位各接一条；溢出内容进 __overflow。
export type SlideSlots = Record<string, string[]>

export function distributeToSlots(layout: SlideLayout, bullets: string[], opts?: { stage?: StageKey; subject?: string }): SlideSlots {
  const sk = getSkeleton(layout, opts)
  if (!sk) return {}
  const slots: SlideSlots = {}
  let idx = 0
  for (const p of sk.placeholders) {
    // 通用版式的 title 占位由 slide.title 渲染，不消费 bullets；cover 例外（大标题通常写在正文中）。
    if (p.key === 'title' && layout !== 'cover') {
      slots[p.key] = []
      continue
    }
    if (p.kind === 'bullet') {
      const n = Math.max(1, Math.ceil((bullets.length - idx) / remainingBulletCount(sk.placeholders, p)))
      let chunk = bullets.slice(idx, idx + n)
      // 子条目展开：若某条是用换行分隔的 bullet（•/- 开头多行），展开成多条，使多列卡片能均分填满
      if (p.columns && p.columns > 1) {
        const expanded = chunk.flatMap((line) => {
          const sub = line.split(/\n+/).map((x) => x.replace(/^[\s•\-*]+/, '').trim()).filter(Boolean)
          return sub.length > 1 ? sub : [line]
        })
        if (expanded.length >= p.columns) chunk = expanded
      }
      slots[p.key] = chunk.length ? chunk : []
      idx += n
    } else {
      slots[p.key] = bullets[idx] !== undefined ? [bullets[idx]] : []
      idx += 1
    }
  }
  if (idx < bullets.length) slots['__overflow'] = bullets.slice(idx)
  return slots
}

// 计算从当前 bullet 占位起，剩余还需要分配的 bullet 占位数量（用于等分）
function remainingBulletCount(phs: Placeholder[], current: Placeholder): number {
  let c = 0
  let seen = false
  for (const p of phs) {
    if (p === current) { seen = true; continue }
    if (seen && p.kind === 'bullet') c++
  }
  return c + 1 // 含自身
}

// 模板替换时按 placeholder key 重映射（内容随新骨架的 key 自动对应）。
// 同名 key 直接迁移；新骨架独有 key 留空；旧骨架独有 key 进 __overflow（不丢）。
export function remapSlots(oldLayout: SlideLayout, newLayout: SlideLayout, slots: SlideSlots, opts?: { stage?: StageKey; subject?: string }): SlideSlots {
  const oldSk = getSkeleton(oldLayout, opts)
  const newSk = getSkeleton(newLayout, opts)
  if (!oldSk || !newSk) return slots
  const oldKeys = new Set(oldSk.placeholders.map((p) => p.key))
  const next: SlideSlots = {}
  for (const p of newSk.placeholders) {
    next[p.key] = slots[p.key] ?? (oldKeys.size === newSk.placeholders.length && oldSk.placeholders.every((o, i) => o.key === newSk.placeholders[i].key) ? [] : [])
  }
  // 旧骨架多余的 key 进溢出，避免内容丢失
  const overflow: string[] = []
  for (const k of Object.keys(slots)) {
    if (k === '__overflow') { overflow.push(...slots[k]); continue }
    if (!newSk.placeholders.some((p) => p.key === k)) overflow.push(...slots[k])
  }
  if (overflow.length) next['__overflow'] = overflow
  return next
}

// ── 模板内置装饰元件引用（引用 + 快照，复用素材库图片）──
// 装饰元件 = 素材库里的图片（category=decor_element），非独立资产。
// 模板引用其 assetId + version（版本概念），snapshot 兜底防元件被删。
export interface DecorSlot {
  /** 引用：素材库装饰元件 id（素材库图片） */
  assetId: string
  /** 引用：该元件的版本（素材库已有 version 概念） */
  version?: string
  /** 元件名称（对齐素材库 materials.name，供 AI 推荐去重、装饰面板展示） */
  name?: string
  /** 快照：关键渲染信息兜底（元件被删/版本缺失时仍可渲染） */
  snapshot: { url: string; w?: number; h?: number }
  /** 装饰槽位类型：页眉/页脚/角标/浮动/背景 */
  slot: 'header' | 'footer' | 'corner' | 'floating' | 'background'
  /** 位置快照（画布百分比） */
  position?: { x: number; y: number; w: number; h: number }
}

// ── 多维聚类标签（借鉴 51miz 课件频道：风格自由标签 + 场景/学段/学科 作为检索 facet）──
// 设计原则（用户对齐）：
//   * 风格(style) 是模板的"先天属性"，驱动装饰匹配（STYLE_DECOR_MAP）；
//   * 学段/学科/场景 是"后天描述"，从模板实际用途反推，作为辅助筛选 facet，非导航主导；
//   * 色系(colorFamily) 是"后生成的描述属性"——先有模板、再由其主色聚类到色系，
//     而非先定色系再生模板。故 colorFamily 仅作可选筛选，不进分类导航。
export type StageTag = 'kindergarten' | 'primary' | 'junior' | 'senior' | 'college'
export type SubjectTag =
  | 'chinese' | 'math' | 'english' | 'physics' | 'chemistry' | 'biology'
  | 'history' | 'geography' | 'politics' | 'science' | 'art' | 'pe' | 'it'
export type ScenarioTag =
  | 'lecture'        // 说课
  | 'parents'        // 家长会
  | 'class-meeting'  // 主题班会
  | 'first-class'    // 开学第一课
  | 'open-class'     // 公开课/示范课
  | 'review'         // 复习/备考
  | 'training'       // 教师培训
  | 'general'        // 常规授课（通用）
export type PageTypeTag = 'cover' | 'toc' | 'content' | 'summary' | 'homework' | 'section'
export type TplTagKind = 'style' | 'stage' | 'subject' | 'scenario' | 'pageType'
export interface TplTag { kind: TplTagKind; value: string }

export const STAGE_LABELS: Record<StageTag, string> = {
  kindergarten: '幼儿园',
  primary: '小学',
  junior: '初中',
  senior: '高中',
  college: '大学',
}
export const SUBJECT_LABELS: Record<SubjectTag, string> = {
  chinese: '语文', math: '数学', english: '英语', physics: '物理', chemistry: '化学',
  biology: '生物', history: '历史', geography: '地理', politics: '政治', science: '科学',
  art: '美术', pe: '体育', it: '信息',
}
export const SCENARIO_LABELS: Record<ScenarioTag, string> = {
  lecture: '说课', parents: '家长会', 'class-meeting': '主题班会', 'first-class': '开学第一课',
  'open-class': '公开课', review: '复习备考', training: '教师培训', general: '常规授课',
}
export const PAGETYPE_LABELS: Record<PageTypeTag, string> = {
  cover: '封面', toc: '目录', content: '内容', summary: '小结', homework: '作业', section: '分隔',
}

// ── 模板对象：配色 + 版式骨架 + 内置装饰 打包成一套可套用对象 ──
export interface CwTemplate {
  id: string
  kind: TemplateKind
  name: string
  style: StyleTag                                     // 主风格（驱动装饰匹配；同时作为风格 facet）
  /** ★ 多维聚类标签：风格/学段/学科/场景/页型混合，供面板多选筛选（OR 语义） */
  tags?: TplTag[]
  /** ★ 色系：后生成的描述属性（由模板主色聚类而来），仅作可选筛选 */
  colorFamily?: string
  themeId: string                                   // 复用现有 CwTheme 配色
  layouts: Partial<Record<SlideLayout, LayoutSkeleton>> // 该模板提供的版式骨架（默认用 edu-* 教学版式）
  /** ★ 模板全局装饰（每页都挂的装饰，如页眉/页脚） */
  globalDecor?: DecorSlot[]
  /** ★ 按版式的专属装饰（覆盖/叠加 globalDecor） */
  decorByLayout?: Partial<Record<SlideLayout, DecorSlot[]>>
  subjects?: string[]                               // 适配学科（空=通用，向后兼容）
  grades?: ('小学' | '初中' | '高中')[]             // 适配学段（空=通用，向后兼容）
  cover?: string                                    // 封面缩微图（dataURL/SVG）；留空则由 renderTemplateThumb 自动生成
  demoOutline?: OutlineSlide[]                      // 示例提纲：空课件套用时注入，立即可见版式预览（教师填空式替换）
}

// 派生模板的风格标签（style 即主风格，兼容旧语义）
export function templateStyleTags(tpl: CwTemplate): StyleTag[] {
  const fromTags = (tpl.tags ?? []).filter((t) => t.kind === 'style').map((t) => t.value as StyleTag)
  return fromTags.length ? Array.from(new Set([tpl.style, ...fromTags])) : [tpl.style]
}

// 派生模板的色系（后生成描述属性，直接读 colorFamily）
export function templateColorTags(tpl: CwTemplate): string[] {
  return tpl.colorFamily ? [tpl.colorFamily] : []
}

// 派生模板的各 facet 分组（学段/学科/场景/页型），供面板多选筛选
export function templateFacets(tpl: CwTemplate): {
  stage: StageTag[]; subject: SubjectTag[]; scenario: ScenarioTag[]; pageType: PageTypeTag[]
} {
  const tags = tpl.tags ?? []
  const pick = <T extends string>(kind: TplTagKind) =>
    tags.filter((t) => t.kind === kind).map((t) => t.value as T)
  return {
    stage: pick<StageTag>('stage'),
    subject: pick<SubjectTag>('subject'),
    scenario: pick<ScenarioTag>('scenario'),
    pageType: pick<PageTypeTag>('pageType'),
  }
}

// ── PPT 模板池：基于现有 56 套 CwTheme 配色铺满 8 类风格（各标签下素材积累多少算多少） ──
// themeId 全部复用 pptThemes.ts 真实存在的 CwTheme；名称取「主题名·风格课件」形式，所见即所得。
import { getTheme } from './pptThemes'
import type { CwTheme } from './pptThemes'
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

// ── 场景化示范提纲库：让模板"内容充分"（贴合风格/学科/学段，而非通用填空） ──
// 工厂按 def.demoOutline → lookupScenarioOutline → eduDemoOutline 优先级回落。
const DEMO_CHINA_CHINESE: OutlineSlide[] = [
  { title: '封面', bullets: ['《课题名称》', '年级 · 学科', '授课教师：XXX'], layout: 'edu-cover', notes: '可配水墨/山水背景' },
  { title: '学习目标', bullets: ['语言建构：诵读积累，理解文意', '审美鉴赏：品味语言，赏析手法', '文化传承：体悟情感与文化自信'], layout: 'edu-goal', notes: '' },
  { title: '作者与背景', bullets: ['作者简介（时代 / 生平 / 代表作）', '创作背景与社会语境'], layout: 'edu-explain', notes: '结合史料或题解' },
  { title: '初读感知', bullets: ['朗读正音，读准字词', '整体感知，概括内容大意'], layout: 'title-body', notes: '' },
  { title: '精读赏析', bullets: ['抓意象 / 关键词，品味语言', '名句赏析与手法探微', '情感脉络梳理'], layout: 'edu-explain', notes: '可分组讨论重点句' },
  { title: '合作探究', bullets: ['探究问题：主题与现实意义', '小组分享，互评补充'], layout: 'edu-example', notes: '' },
  { title: '拓展延伸', bullets: ['关联阅读 / 同题材作品', '文化链接与现实关照'], layout: 'content-2col', notes: '' },
  { title: '课堂小结', bullets: ['核心收获梳理', '知识结构导图'], layout: 'edu-summary', notes: '' },
  { title: '课后作业', bullets: ['基础：背诵 / 默写', '提升：练笔或短文评析'], layout: 'edu-homework', notes: '' },
]

const DEMO_CARTOON_KINDER: OutlineSlide[] = [
  { title: '封面', bullets: ['课程《XXX》', 'XX 班的小朋友们', '老师：XXX'], layout: 'edu-cover', notes: '大图大字，童趣可爱' },
  { title: '今天的目标', bullets: ['认知：认识……', '能力：学会……', '情感：喜欢……'], layout: 'edu-goal', notes: '' },
  { title: '情境导入', bullets: ['小动物（或绘本）故事引出', '激发兴趣，明确今天任务'], layout: 'title-body', notes: '' },
  { title: '趣味认知', bullets: ['看一看：图片 / 实物认一认', '听一听：儿歌 / 故事'], layout: 'edu-explain', notes: '' },
  { title: '游戏互动', bullets: ['一起来做游戏', '动手试一试'], layout: 'edu-example', notes: '分组或集体游戏' },
  { title: '动动手', bullets: ['手工 / 绘画', '展示与分享'], layout: 'content-2col', notes: '' },
  { title: '快乐小结', bullets: ['今天学会了什么', '给自己鼓鼓掌'], layout: 'edu-summary', notes: '' },
  { title: '亲子小任务', bullets: ['和爸爸妈妈一起……', '拍照片分享'], layout: 'edu-homework', notes: '' },
]

const SCENARIO_OUTLINES: Record<string, OutlineSlide[]> = {
  'china-chinese': DEMO_CHINA_CHINESE,
  'cartoon-kindergarten': DEMO_CARTOON_KINDER,
}

// 按风格 + 学科/学段自动匹配示范提纲（后续批量填充时复用，无需逐套手写）
function lookupScenarioOutline(def: TplDef): OutlineSlide[] | undefined {
  const subj = def.subjects?.[0]
  if (def.style === 'china' && (subj === 'chinese' || subj === 'history'))
    return SCENARIO_OUTLINES['china-chinese']
  const isKinder = def.tags?.some((t) => t.kind === 'stage' && t.value === 'kindergarten')
  if ((def.style === 'cartoon' || def.style === 'fresh') && isKinder)
    return SCENARIO_OUTLINES['cartoon-kindergarten']
  return undefined
}

// 模板定义输入：在「风格 + 多维标签 + 色系描述」上声明，配色 themeId 复用 pptThemes.ts 真实 CwTheme。
// 设计原则（用户对齐）：风格/学段/学科/场景是模板"先天自带"的语义标签，色系(colorFamily)是
// 由主题主色聚类而来的"后生成描述属性"，不反向驱动模板生成。
interface TplDef {
  style: StyleTag
  themeId: string
  colorFamily: string                              // 后生成：与该主题主色最贴近的色系 id
  name?: string
  tags?: TplTag[]
  subjects?: string[]
  grades?: ('小学' | '初中' | '高中')[]
  /** 内容充分度：差异化示范提纲。缺省回落 eduDemoOutline() 通用提纲。 */
  demoOutline?: OutlineSlide[]
}

function pptTemplate(
  id: string,
  def: TplDef,
  kind: TemplateKind = 'ppt',
): CwTemplate {
  const th = getTheme(def.themeId)
  return {
    id,
    kind,
    name: def.name ?? `${th?.name ?? def.themeId}·${STYLE_LABELS[def.style]}课件`,
    style: def.style,
    tags: def.tags,
    colorFamily: def.colorFamily,
    themeId: def.themeId,
    // 每套模板都自带同一套教学版式骨架（结构占位通用，配色由 themeId 决定）
    layouts: { ...EDU_LAYOUT_SKELETONS },
    subjects: def.subjects,
    grades: def.grades,
    globalDecor: decorForScenario(def),
    // 内容充分度：优先用模板自带提纲 → 场景匹配提纲 → 回落通用提纲
    demoOutline: def.demoOutline ?? lookupScenarioOutline(def) ?? eduDemoOutline(),
  }
}

// 多维标签构造助手（保持声明紧凑）
const t = (kind: TplTagKind, value: string): TplTag => ({ kind, value })
const styles = (...v: StyleTag[]) => v.map((x) => t('style', x))
const stages = (...v: StageTag[]) => v.map((x) => t('stage', x))
const subjects = (...v: SubjectTag[]) => v.map((x) => t('subject', x))
const scenarios = (...v: ScenarioTag[]) => v.map((x) => t('scenario', x))
const pageTypes = (...v: PageTypeTag[]) => v.map((x) => t('pageType', x))

// ── PPT 模板池（借鉴 51miz：场景/用途 + 风格自由标签 + 色系从外观聚类）──
// 每个定义显式声明：风格、主色聚类色系、学段/学科/场景 facet；素材随积累扩充。
const PPT_TEMPLATE_DEFS: TplDef[] = [
  // 国风
  { style: 'china', themeId: 'zgf-ink-wash', colorFamily: 'mono', tags: [...styles('china'), ...scenarios('general'), ...stages('primary', 'junior', 'senior')] },
  { style: 'china', themeId: 'zgf-guochao', colorFamily: 'red-gold', tags: [...styles('china'), ...scenarios('class-meeting', 'first-class'), ...stages('primary', 'junior')] },
  { style: 'china', themeId: 'zgf-shanshui', colorFamily: 'cyan-green', tags: [...styles('china'), ...scenarios('general'), ...stages('junior', 'senior')] },
  { style: 'china', themeId: 'zgf-song-qing', colorFamily: 'cyan-green', tags: [...styles('china'), ...subjects('chinese', 'history'), ...stages('junior', 'senior')], demoOutline: DEMO_CHINA_CHINESE },
  // 素净/简约
  { style: 'minimal', themeId: 'min-classic-blue', colorFamily: 'blue', tags: [...styles('minimal'), ...scenarios('lecture', 'open-class'), ...stages('junior', 'senior')] },
  { style: 'minimal', themeId: 'min-geo', colorFamily: 'gray', tags: [...styles('minimal'), ...scenarios('general'), ...stages('senior', 'college')] },
  { style: 'minimal', themeId: 'min-gray-premium', colorFamily: 'gray', tags: [...styles('minimal', 'business'), ...scenarios('training'), ...stages('college')] },
  { style: 'minimal', themeId: 'min-pure-white', colorFamily: 'gray', tags: [...styles('minimal'), ...scenarios('general'), ...stages('primary', 'junior', 'senior')] },
  { style: 'minimal', themeId: 'min-modern-line', colorFamily: 'blue', tags: [...styles('minimal'), ...scenarios('lecture'), ...stages('junior', 'senior')] },
  { style: 'minimal', themeId: 'min-navy-intellectual', colorFamily: 'blue', tags: [...styles('minimal', 'academic'), ...subjects('math', 'physics'), ...stages('senior', 'college')] },
  // 科技
  { style: 'tech', themeId: 'te-quantum-blue', colorFamily: 'blue', tags: [...styles('tech'), ...subjects('it', 'physics'), ...stages('junior', 'senior', 'college')] },
  { style: 'tech', themeId: 'te-tech-navy', colorFamily: 'blue', tags: [...styles('tech'), ...scenarios('open-class'), ...stages('senior', 'college')] },
  { style: 'tech', themeId: 'te-cyber-purple', colorFamily: 'purple', tags: [...styles('tech'), ...subjects('it'), ...stages('junior', 'senior')] },
  { style: 'tech', themeId: 'te-aurora-green', colorFamily: 'cyan-green', tags: [...styles('tech'), ...subjects('science', 'biology'), ...stages('junior', 'senior')] },
  { style: 'tech', themeId: 'te-digital-cyan', colorFamily: 'cyan-green', tags: [...styles('tech'), ...scenarios('first-class'), ...stages('primary', 'junior')] },
  // 清新
  { style: 'fresh', themeId: 'fr-mint', colorFamily: 'cyan-green', tags: [...styles('fresh'), ...stages('kindergarten', 'primary')], demoOutline: DEMO_CARTOON_KINDER },
  { style: 'fresh', themeId: 'fr-sky-blue', colorFamily: 'blue', tags: [...styles('fresh'), ...scenarios('parents'), ...stages('kindergarten', 'primary')] },
  { style: 'fresh', themeId: 'fr-warm-orange', colorFamily: 'warm', tags: [...styles('fresh'), ...stages('kindergarten', 'primary')] },
  { style: 'fresh', themeId: 'fr-macaron-pink', colorFamily: 'purple', tags: [...styles('fresh'), ...subjects('art'), ...stages('kindergarten', 'primary')] },
  { style: 'fresh', themeId: 'fr-sakura', colorFamily: 'warm', tags: [...styles('fresh'), ...stages('primary', 'junior')] },
  // 严谨/学术
  { style: 'academic', themeId: 'aca-edu-blue', colorFamily: 'blue', tags: [...styles('academic'), ...scenarios('lecture', 'review'), ...stages('junior', 'senior', 'college')] },
  { style: 'academic', themeId: 'aca-rational', colorFamily: 'gray', tags: [...styles('academic'), ...subjects('math', 'physics', 'chemistry'), ...stages('senior', 'college')] },
  { style: 'academic', themeId: 'aca-deep-green', colorFamily: 'cyan-green', tags: [...styles('academic'), ...subjects('biology', 'science'), ...stages('junior', 'senior')] },
  { style: 'academic', themeId: 'aca-cream', colorFamily: 'warm', tags: [...styles('academic'), ...stages('primary', 'junior')] },
  // 卡通（绘本/插画风，借鉴 GordenPPTSkill 卡通模板风格）
  { style: 'cartoon', themeId: 'sp-cartoon', colorFamily: 'gradient', tags: [...styles('cartoon'), ...pageTypes('cover', 'content'), ...stages('kindergarten', 'primary')] },
  { style: 'cartoon', themeId: 'sp-doodle', colorFamily: 'gradient', tags: [...styles('cartoon'), ...scenarios('class-meeting'), ...pageTypes('content', 'summary'), ...stages('kindergarten', 'primary')] },
  { style: 'cartoon', themeId: 'gr-orange-pink', colorFamily: 'gradient', tags: [...styles('cartoon'), ...subjects('art', 'english'), ...pageTypes('cover', 'content', 'homework'), ...stages('kindergarten', 'primary')] },
  { style: 'cartoon', themeId: 'fr-macaron-pink', colorFamily: 'purple', tags: [...styles('cartoon'), ...subjects('art'), ...pageTypes('cover', 'content'), ...stages('kindergarten', 'primary', 'junior')] },
  { style: 'cartoon', themeId: 'fr-warm-orange', colorFamily: 'warm', tags: [...styles('cartoon'), ...scenarios('first-class'), ...stages('kindergarten', 'primary')] },
  { style: 'cartoon', themeId: 'gr-gold-orange', colorFamily: 'warm', tags: [...styles('cartoon'), ...subjects('pe', 'art'), ...stages('kindergarten', 'primary', 'junior')] },
  // 红色教育（主题教育/党政红/节日红金，借鉴 GordenPPTSkill 红色教育模板风格）
  { style: 'cartoon', themeId: 'sp-party-red', colorFamily: 'red-gold', tags: [...styles('cartoon'), ...scenarios('class-meeting', 'first-class'), ...subjects('politics'), ...stages('primary', 'junior', 'senior')] },
  { style: 'cartoon', themeId: 'sp-festive', colorFamily: 'red-gold', tags: [...styles('cartoon'), ...scenarios('class-meeting', 'first-class'), ...subjects('chinese', 'politics', 'english'), ...stages('primary', 'junior', 'senior')] },
  { style: 'china', themeId: 'zgf-classic-red', colorFamily: 'red-gold', tags: [...styles('china'), ...scenarios('class-meeting', 'first-class'), ...subjects('chinese', 'history', 'politics'), ...stages('junior', 'senior')] },
  { style: 'china', themeId: 'zgf-guochao', colorFamily: 'red-gold', tags: [...styles('china'), ...scenarios('class-meeting'), ...stages('primary', 'junior')] },
  // 扁平
  { style: 'flat', themeId: 'mo-haze-blue', colorFamily: 'blue', tags: [...styles('flat'), ...stages('primary', 'junior')] },
  { style: 'flat', themeId: 'mo-gray-purple', colorFamily: 'purple', tags: [...styles('flat'), ...subjects('art'), ...stages('primary', 'junior')] },
  { style: 'flat', themeId: 'mo-bean-green', colorFamily: 'cyan-green', tags: [...styles('flat'), ...subjects('science'), ...stages('primary', 'junior')] },
  // 沉稳/商务
  { style: 'business', themeId: 'gr-blue-purple', colorFamily: 'purple', tags: [...styles('business'), ...scenarios('training', 'parents'), ...stages('college')] },
  { style: 'business', themeId: 'wa-elegant-purple', colorFamily: 'purple', tags: [...styles('business'), ...scenarios('open-class'), ...stages('senior', 'college')] },
  // 通用结构（骨架 × 色系，不绑定具体场景）
  { style: 'basic', themeId: 'min-classic-blue', colorFamily: 'blue', tags: [...styles('basic'), ...scenarios('general')] },
  { style: 'basic', themeId: 'min-pure-white', colorFamily: 'gray', tags: [...styles('basic'), ...scenarios('general')] },
  { style: 'basic', themeId: 'aca-edu-blue', colorFamily: 'blue', tags: [...styles('basic'), ...scenarios('general')] },
]

// H5 互动课件模板池：偏向亮色/跳色（投屏平板更出彩），卡通/清新权重更高，沉稳/严谨权重更低。
// 与 PPT 共用同一套风格标签与配色，仅标签倾斜；规则体系完全一致（借鉴 51miz 互动场景）。
const H5_TEMPLATE_DEFS: TplDef[] = [
  { style: 'china', themeId: 'zgf-guochao', colorFamily: 'red-gold', tags: [...styles('china'), ...scenarios('first-class', 'class-meeting'), ...stages('primary', 'junior')] },
  { style: 'china', themeId: 'zgf-shanshui', colorFamily: 'cyan-green', tags: [...styles('china'), ...scenarios('general'), ...stages('junior', 'senior')] },
  { style: 'china', themeId: 'zgf-song-qing', colorFamily: 'cyan-green', tags: [...styles('china'), ...subjects('chinese', 'history'), ...stages('junior', 'senior')] },
  { style: 'minimal', themeId: 'min-pure-white', colorFamily: 'gray', tags: [...styles('minimal'), ...scenarios('general'), ...stages('primary', 'junior', 'senior')] },
  { style: 'minimal', themeId: 'min-modern-line', colorFamily: 'blue', tags: [...styles('minimal'), ...scenarios('lecture'), ...stages('junior', 'senior')] },
  { style: 'minimal', themeId: 'min-navy-intellectual', colorFamily: 'blue', tags: [...styles('minimal', 'academic'), ...subjects('math'), ...stages('senior', 'college')] },
  { style: 'tech', themeId: 'te-quantum-blue', colorFamily: 'blue', tags: [...styles('tech'), ...subjects('it', 'physics'), ...stages('junior', 'senior', 'college')] },
  { style: 'tech', themeId: 'te-aurora-green', colorFamily: 'cyan-green', tags: [...styles('tech'), ...subjects('science'), ...stages('junior', 'senior')] },
  { style: 'tech', themeId: 'te-digital-cyan', colorFamily: 'cyan-green', tags: [...styles('tech'), ...scenarios('first-class'), ...stages('primary', 'junior')] },
  { style: 'fresh', themeId: 'fr-mint', colorFamily: 'cyan-green', tags: [...styles('fresh'), ...stages('kindergarten', 'primary')] },
  { style: 'fresh', themeId: 'fr-sky-blue', colorFamily: 'blue', tags: [...styles('fresh'), ...scenarios('parents'), ...stages('kindergarten', 'primary')] },
  { style: 'fresh', themeId: 'fr-warm-orange', colorFamily: 'warm', tags: [...styles('fresh'), ...stages('kindergarten', 'primary')] },
  { style: 'fresh', themeId: 'fr-macaron-pink', colorFamily: 'purple', tags: [...styles('fresh'), ...subjects('art'), ...stages('kindergarten', 'primary')] },
  { style: 'fresh', themeId: 'fr-sakura', colorFamily: 'warm', tags: [...styles('fresh'), ...stages('primary', 'junior')] },
  { style: 'fresh', themeId: 'fr-lemon', colorFamily: 'gradient', tags: [...styles('fresh'), ...stages('kindergarten', 'primary')] },
  { style: 'academic', themeId: 'aca-edu-blue', colorFamily: 'blue', tags: [...styles('academic'), ...scenarios('review'), ...stages('junior', 'senior', 'college')] },
  { style: 'academic', themeId: 'aca-deep-green', colorFamily: 'cyan-green', tags: [...styles('academic'), ...subjects('biology'), ...stages('junior', 'senior')] },
  { style: 'cartoon', themeId: 'sp-cartoon', colorFamily: 'gradient', tags: [...styles('cartoon'), ...pageTypes('cover', 'content'), ...stages('kindergarten', 'primary')] },
  { style: 'cartoon', themeId: 'sp-doodle', colorFamily: 'gradient', tags: [...styles('cartoon'), ...scenarios('class-meeting'), ...pageTypes('content', 'summary'), ...stages('kindergarten', 'primary')] },
  { style: 'cartoon', themeId: 'gr-orange-pink', colorFamily: 'gradient', tags: [...styles('cartoon'), ...subjects('art', 'english'), ...pageTypes('cover', 'content', 'homework'), ...stages('kindergarten', 'primary')] },
  { style: 'cartoon', themeId: 'fr-macaron-pink', colorFamily: 'purple', tags: [...styles('cartoon'), ...subjects('art'), ...pageTypes('cover', 'content'), ...stages('kindergarten', 'primary', 'junior')] },
  { style: 'cartoon', themeId: 'fr-warm-orange', colorFamily: 'warm', tags: [...styles('cartoon'), ...scenarios('first-class'), ...stages('kindergarten', 'primary')] },
  { style: 'cartoon', themeId: 'gr-gold-orange', colorFamily: 'warm', tags: [...styles('cartoon'), ...subjects('pe', 'art'), ...stages('kindergarten', 'primary', 'junior')] },
  { style: 'cartoon', themeId: 'sp-party-red', colorFamily: 'red-gold', tags: [...styles('cartoon'), ...scenarios('first-class', 'class-meeting'), ...subjects('politics'), ...stages('kindergarten', 'primary', 'junior', 'senior')] },
  { style: 'cartoon', themeId: 'sp-festive', colorFamily: 'red-gold', tags: [...styles('cartoon'), ...scenarios('class-meeting', 'first-class'), ...subjects('chinese', 'politics', 'english'), ...stages('primary', 'junior', 'senior')] },
  { style: 'china', themeId: 'zgf-classic-red', colorFamily: 'red-gold', tags: [...styles('china'), ...scenarios('class-meeting', 'first-class'), ...subjects('chinese', 'history', 'politics'), ...stages('junior', 'senior')] },
  { style: 'china', themeId: 'zgf-guochao', colorFamily: 'red-gold', tags: [...styles('china'), ...scenarios('class-meeting'), ...stages('primary', 'junior')] },
  { style: 'flat', themeId: 'mo-haze-blue', colorFamily: 'blue', tags: [...styles('flat'), ...stages('primary', 'junior')] },
  { style: 'flat', themeId: 'mo-gray-purple', colorFamily: 'purple', tags: [...styles('flat'), ...subjects('art'), ...stages('primary', 'junior')] },
  { style: 'flat', themeId: 'mo-bean-green', colorFamily: 'cyan-green', tags: [...styles('flat'), ...subjects('science'), ...stages('primary', 'junior')] },
  { style: 'flat', themeId: 'mo-rose-gray', colorFamily: 'purple', tags: [...styles('flat'), ...stages('primary', 'junior')] },
  { style: 'business', themeId: 'gr-blue-purple', colorFamily: 'purple', tags: [...styles('business'), ...scenarios('training'), ...stages('college')] },
  { style: 'business', themeId: 'wa-elegant-purple', colorFamily: 'purple', tags: [...styles('business'), ...scenarios('open-class'), ...stages('senior', 'college')] },
  { style: 'basic', themeId: 'min-pure-white', colorFamily: 'gray', tags: [...styles('basic'), ...scenarios('general')] },
  { style: 'basic', themeId: 'aca-edu-blue', colorFamily: 'blue', tags: [...styles('basic'), ...scenarios('general')] },
]

// 风格 → 默认落地配色（AI 生成风格时用于自动套用；取该风格下首个模板定义的 themeId）
export function defaultThemeForStyle(style: StyleTag): string {
  return PPT_TEMPLATE_DEFS.find((d) => d.style === style)?.themeId || 'min-classic-blue'
}

// ── 模板内置装饰：按风格（style）匹配语义化装饰，而非所有模板同套一个 ──
// 装饰元件 = 素材库图片（category=decor_element）。当前素材图片资源尚未就绪，
// 这里用内联 SVG（dataURL）保证编辑器内真实可见、可选中替换；待平台上传真实装饰元件后，
// 将 snapshot.url 替换为素材库 URL，assetId 对齐素材库元件 id 即可。
function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

// 每个风格配：1 个角标（corner，右下角）+ 1 个浮动点缀（floating，右上角）
// 颜色与风格语义呼应（后续可按 COLOR_FAMILIES 的 swatch 进一步精确匹配）
const STYLE_DECOR_MAP: Record<StyleTag, DecorSlot[]> = {
  china: [
    { assetId: 'decor-china-seal', name: '国风印章', snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect x="6" y="6" width="52" height="52" rx="8" fill="none" stroke="#B5121B" stroke-width="3"/><text x="32" y="42" font-size="28" text-anchor="middle" fill="#B5121B" font-family="serif">印</text></svg>`) }, slot: 'corner' },
    { assetId: 'decor-china-bamboo', name: '国风竹枝', snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40" viewBox="0 0 80 40"><g stroke="#1E5631" stroke-width="2" fill="none"><path d="M12 40 Q14 20 10 4"/><path d="M12 14 Q22 16 20 6"/><path d="M12 24 Q20 22 22 30"/><path d="M28 40 Q30 22 26 8"/><path d="M28 18 Q36 20 34 10"/><path d="M28 26 Q36 24 38 32"/></g></svg>`) }, slot: 'floating' },
  ],
  minimal: [
    { assetId: 'decor-minimal-line', name: '素净同心圆', snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" fill="none" stroke="#9AA0A6" stroke-width="2"/><circle cx="32" cy="32" r="18" fill="none" stroke="#9AA0A6" stroke-width="1"/></svg>`) }, slot: 'corner' },
    { assetId: 'decor-minimal-dot', name: '素净圆点', snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="5" fill="#C0C4C8"/></svg>`) }, slot: 'floating' },
  ],
  tech: [
    { assetId: 'decor-tech-hex', name: '科技六边形', snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><polygon points="32,6 56,20 56,44 32,58 8,44 8,20" fill="none" stroke="#02A7F0" stroke-width="2.5"/><circle cx="32" cy="32" r="6" fill="#02A7F0"/></svg>`) }, slot: 'corner' },
    { assetId: 'decor-tech-grid', name: '科技网格', snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><g stroke="#7FB8E6" stroke-width="1" fill="none"><path d="M0 20 H60 M0 40 H60 M20 0 V60 M40 0 V60"/></g></svg>`) }, slot: 'floating' },
  ],
  fresh: [
    { assetId: 'decor-fresh-leaf', name: '清新叶子', snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><path d="M32 56 C10 44 8 16 28 8 C52 2 58 30 32 56 Z" fill="#8FD3B6"/><path d="M28 12 C40 18 40 34 28 48" stroke="#1E5631" stroke-width="2" fill="none"/></svg>`) }, slot: 'corner' },
    { assetId: 'decor-fresh-leaf-sm', name: '清新小叶', snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><path d="M20 36 C8 28 6 12 18 6 C32 2 36 22 20 36 Z" fill="#A8D8C0"/></svg>`) }, slot: 'floating' },
  ],
  academic: [
    { assetId: 'decor-aca-rule', name: '严谨斜线', snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><line x1="8" y1="56" x2="56" y2="8" stroke="#1F4E79" stroke-width="3"/><line x1="16" y1="56" x2="56" y2="16" stroke="#1F4E79" stroke-width="1.5"/><line x1="8" y1="48" x2="48" y2="8" stroke="#1F4E79" stroke-width="1.5"/></svg>`) }, slot: 'corner' },
    { assetId: 'decor-aca-line', name: '严谨横线', snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="60" height="10" viewBox="0 0 60 10"><rect x="0" y="3" width="60" height="4" fill="#1F4E79"/></svg>`) }, slot: 'floating' },
  ],
  cartoon: [
    { assetId: 'decor-cartoon-sun', name: '卡通太阳', snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="16" fill="#FFB020"/><g stroke="#FFB020" stroke-width="3" stroke-linecap="round"><line x1="32" y1="6" x2="32" y2="14"/><line x1="32" y1="50" x2="32" y2="58"/><line x1="6" y1="32" x2="14" y2="32"/><line x1="50" y1="32" x2="58" y2="32"/><line x1="13" y1="13" x2="19" y2="19"/><line x1="45" y1="45" x2="51" y2="51"/><line x1="13" y1="51" x2="19" y2="45"/><line x1="45" y1="19" x2="51" y2="13"/></g></svg>`) }, slot: 'corner' },
    { assetId: 'decor-cartoon-star', name: '卡通星星', snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><polygon points="20,4 24,15 36,15 26,22 30,34 20,27 10,34 14,22 4,15 16,15" fill="#FFC53D"/></svg>`) }, slot: 'floating' },
  ],
  flat: [
    { assetId: 'decor-flat-circle', name: '扁平双圆', snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="20" cy="44" r="14" fill="#E8EAF0"/><circle cx="44" cy="20" r="10" fill="#D0D5DD"/></svg>`) }, slot: 'corner' },
    { assetId: 'decor-flat-dot', name: '扁平圆点组', snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="12" cy="28" r="7" fill="#E8EAF0"/><circle cx="28" cy="12" r="5" fill="#C8CDD6"/></svg>`) }, slot: 'floating' },
  ],
  business: [
    { assetId: 'decor-biz-line', name: '沉稳边框', snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect x="10" y="18" width="44" height="34" fill="none" stroke="#4A4A4A" stroke-width="2.5"/><line x1="10" y1="28" x2="54" y2="28" stroke="#4A4A4A" stroke-width="1.5"/></svg>`) }, slot: 'corner' },
    { assetId: 'decor-biz-bar', name: '沉稳色块条', snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="60" height="8" viewBox="0 0 60 8"><rect x="0" y="0" width="60" height="8" fill="#4A4A4A"/></svg>`) }, slot: 'floating' },
  ],
  basic: [
    { assetId: 'decor-basic-corner', name: '通用角标', snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><path d="M4 60 L60 60 L60 4" fill="none" stroke="#B0B6BD" stroke-width="3"/></svg>`) }, slot: 'corner' },
    { assetId: 'decor-basic-dot', name: '通用圆点', snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="4" fill="#B0B6BD"/></svg>`) }, slot: 'floating' },
  ],
}

// 取某风格的模板内置装饰（缺省回退到 basic 的通用装饰）
function decorForStyle(style: StyleTag): DecorSlot[] {
  return STYLE_DECOR_MAP[style] || STYLE_DECOR_MAP.basic
}

// ── 装饰按"套路"差异化：同一风格下，不同学科/学段用各自匹配的点缀 ──
// key 与 SCENARIO_OUTLINES 对齐（style + 主学科/学段）。缺省回落风格级通用装饰。
const SCENARIO_DECOR_MAP: Record<string, DecorSlot[]> = {
  'china-chinese': [
    { assetId: 'decor-china-brush', name: '国风毛笔', snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect x="10" y="6" width="44" height="9" rx="3" fill="#7A1F1F"/><path d="M28 15 L36 15 L33 50 Z" fill="#3A2A1A"/><path d="M31 50 Q33 60 35 50 Q33 55 31 50 Z" fill="#1C1C1C"/><circle cx="14" cy="54" r="3" fill="#1E5631"/></svg>`) }, slot: 'corner' },
    { assetId: 'decor-china-cloud', name: '国风卷云', snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40" viewBox="0 0 80 40"><path d="M8 28 Q8 16 20 16 Q24 8 34 12 Q44 8 46 18 Q58 16 58 26 Q58 32 48 32 L16 32 Q8 32 8 28 Z" fill="none" stroke="#B5121B" stroke-width="2"/></svg>`) }, slot: 'floating' },
  ],
  'cartoon-kindergarten': [
    { assetId: 'decor-kinder-bear', name: '卡通小熊', snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="34" r="20" fill="#F4A261"/><circle cx="22" cy="18" r="6" fill="#F4A261"/><circle cx="42" cy="18" r="6" fill="#F4A261"/><circle cx="25" cy="32" r="3" fill="#3A2A1A"/><circle cx="39" cy="32" r="3" fill="#3A2A1A"/><ellipse cx="32" cy="40" rx="5" ry="4" fill="#3A2A1A"/></svg>`) }, slot: 'corner' },
    { assetId: 'decor-kinder-balloon', name: '卡通气球', snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48"><ellipse cx="20" cy="16" rx="13" ry="15" fill="#FF6B9D"/><path d="M20 31 L20 40" stroke="#FF6B9D" stroke-width="1.5"/><path d="M16 40 L24 40 L20 45 Z" fill="#FF6B9D"/></svg>`) }, slot: 'floating' },
  ],
}

// 套路装饰匹配：style × 学科/学段 → 专属点缀；无匹配则回落风格级通用装饰
function decorForScenario(def: TplDef): DecorSlot[] {
  const subj = def.subjects?.[0]
  let key: string | undefined
  if (def.style === 'china' && (subj === 'chinese' || subj === 'history')) key = 'china-chinese'
  else if ((def.style === 'cartoon' || def.style === 'fresh') &&
    def.tags?.some((t) => t.kind === 'stage' && t.value === 'kindergarten')) key = 'cartoon-kindergarten'
  if (key && SCENARIO_DECOR_MAP[key]) return SCENARIO_DECOR_MAP[key]
  return decorForStyle(def.style)
}

// 由显式模板定义池生成模板数组（多维标签 + colorFamily 已内置于 def）
function buildTemplates(kind: TemplateKind, defs: TplDef[]): CwTemplate[] {
  return defs.map((def, i) =>
    pptTemplate(`${kind}-${def.style}-${i + 1}`, def, kind),
  )
}

export const PPT_TEMPLATES: CwTemplate[] = buildTemplates('ppt', PPT_TEMPLATE_DEFS)
export const H5_TEMPLATES: CwTemplate[] = buildTemplates('h5', H5_TEMPLATE_DEFS)

// 按媒介取模板池
export function getTemplatesByKind(kind: TemplateKind): CwTemplate[] {
  return kind === 'ppt' ? PPT_TEMPLATES : H5_TEMPLATES
}

// 多维筛选条件（均为可选；任一维度传入即以 OR 语义命中该维度）
export interface TplFilter {
  styles?: StyleTag[]          // 风格（OR）
  stages?: StageTag[]          // 学段（OR）
  subjects?: SubjectTag[]      // 学科（OR）
  scenarios?: ScenarioTag[]    // 场景（OR）
  colorFamilies?: string[]     // 色系（OR，后生成描述属性）
}

// 按媒介 + 多维 facet 筛选（借鉴 51miz：风格为主、其余标签辅助检索）
export function getTemplates(kind: TemplateKind, filter?: TplFilter): CwTemplate[] {
  let pool = getTemplatesByKind(kind)
  if (!filter) return pool
  const { styles, stages, subjects, scenarios, colorFamilies } = filter

  if (styles && styles.length) {
    const set = new Set(styles)
    pool = pool.filter((t) => templateStyleTags(t).some((s) => set.has(s)))
  }
  // 某 facet 维度：模板该维度无标签 → 视为通配（适用于所有筛选值）；否则需 OR 命中
  if (stages && stages.length) {
    const set = new Set(stages)
    pool = pool.filter((t) => {
      const f = templateFacets(t).stage
      return f.length === 0 || f.some((s) => set.has(s))
    })
  }
  if (subjects && subjects.length) {
    const set = new Set(subjects)
    pool = pool.filter((t) => {
      const f = templateFacets(t).subject
      return f.length === 0 || f.some((s) => set.has(s))
    })
  }
  if (scenarios && scenarios.length) {
    const set = new Set(scenarios)
    pool = pool.filter((t) => {
      const f = templateFacets(t).scenario
      return f.length === 0 || f.some((s) => set.has(s))
    })
  }
  if (colorFamilies && colorFamilies.length) {
    const set = new Set(colorFamilies)
    pool = pool.filter((t) => (t.colorFamily ? set.has(t.colorFamily) : false))
  }
  return pool
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
  const stageKey = ctx?.stage ?? 'upper'
  const subj = ctx?.subject ?? ''
  const next = outline.map((s, i) => {
    const inferred = inferEduLayout(s, layouts)
    // 仅当骨架提供该版式时才套用，否则保留原 layout
    const layout = inferred ? inferred : s.layout
    // 模板替换：内容按 placeholder key 重映射（同名 key 自动对应，多余内容进溢出区，不丢）
    const slots = s.slots && s.layout && s.layout !== layout
      ? remapSlots(s.layout as SlideLayout, layout as SlideLayout, s.slots, { stage: stageKey, subject: subj })
      : s.slots
    // 模板内置装饰：全局装饰 + 该版式专属装饰，合并挂到 slide.decor（可被编辑器个性替换）
    const decor = decorSlotsFor(tpl, layout as SlideLayout)
    return { ...s, layout, slots, ...(decor ? { decor } : {}) }
  })
  return {
    outline: next,
    themeId: tpl.themeId,
    prevThemeId: curThemeId,
    prevLayouts,
  }
}

// 把模板的 DecorSlot[]（引用+快照）转为 OutlineSlide.decor 用的 DecorSlots（插槽式），
// 供渲染/导出复用现有装饰渲染链路。全局装饰 + 版式专属装饰合并。
function decorSlotsFor(tpl: CwTemplate, layout: SlideLayout): DecorSlots | null {
  const merged: DecorSlot[] = [...(tpl.globalDecor || [])]
  const byLayout = tpl.decorByLayout?.[layout]
  if (byLayout) merged.push(...byLayout)
  if (!merged.length) return null
  const slots: DecorSlots = {}
  for (const d of merged) {
    const item: DecorItem = { id: d.assetId, url: resolveDecorUrl(d.assetId, d.snapshot?.url || ''), name: d.name || '' }
    if (d.slot === 'background') { slots.background = resolveDecorUrl(d.assetId, d.snapshot?.url || ''); continue }
    const key = d.slot === 'header' ? 'header' : d.slot === 'footer' ? 'footer' : d.slot === 'corner' ? 'corners' : 'floating'
    ;(slots as any)[key] = [...((slots as any)[key] || []), item]
  }
  return slots
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
      <text x="8" y="8" font-family="${escapeXmlAttr(th.font || 'sans-serif')}" font-size="7" font-weight="700" fill="${onPrimary}">${escapeXml(tpl.name.slice(0, 14))}</text>
      ${pages}
      <rect x="${startX}" y="${topY + ph + 5}" width="${pw * 3 + gap * 2}" height="3" rx="1.5" fill="${footer}" opacity="0.5"/>
    </g>
  </svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c] as string))
}

/** 属性值转义：除标准 XML 实体外，把属性内双引号换成 &quot;，防止 font-family 等含引号的值破坏 SVG */
function escapeXmlAttr(s: string): string {
  return s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] as string))
}

/** SVG fill 颜色规范化：theme 库中 hex 不带 #，SVG 属性必须带 #，否则 Chrome 会回退成黑色 */
function svgColor(c?: string, fallback = '#CCCCCC'): string {
  if (!c) return fallback
  if (c.startsWith('#')) return c
  if (c.startsWith('linear-gradient') || c.startsWith('rgb') || c.startsWith('hsl')) return fallback
  return '#' + c
}

/** 课件单页缩微图：按主题色 + 版式生成 SVG dataURL，用于左侧页面列表预览 */
export function renderSlideThumb(
  slide: { title?: string; bullets?: string[]; layout?: string },
  theme: CwTheme,
  index: number,
): string {
  const W = 160
  const H = 90
  const primary = svgColor(theme.primary, '#1A3A6B')
  const onPrimary = svgColor(theme.onPrimary, '#FFFFFF')
  const subtle = svgColor(theme.subtle, '#9A9A9A')
  const body = svgColor(theme.body, '#333333')
  const title = escapeXml((slide.title || '（无标题）').slice(0, 18))
  const layout = slide.layout || 'title-body'
  const isTwoCol = layout.includes('two') || layout.includes('col')

  let contentSvg = ''
  if (isTwoCol) {
    const cw = 62
    const ch = 44
    const cy = 28
    contentSvg = `<rect x="12" y="${cy}" width="${cw}" height="${ch}" rx="2" fill="#F2F3F5" stroke="${subtle}" stroke-width="0.5"/>`
      + `<rect x="86" y="${cy}" width="${cw}" height="${ch}" rx="2" fill="#F2F3F5" stroke="${subtle}" stroke-width="0.5"/>`
      + `<rect x="16" y="${cy + 6}" width="40" height="3" rx="1.5" fill="${subtle}"/>`
      + `<rect x="90" y="${cy + 6}" width="40" height="3" rx="1.5" fill="${subtle}"/>`
  } else {
    const bullets = (slide.bullets || []).filter(Boolean).slice(0, 3)
    const lines = bullets.length
      ? bullets.map((b, i) => `<rect x="20" y="${34 + i * 11}" width="${Math.max(40, Math.min(110, (b.length || 4) * 8))}" height="4" rx="2" fill="${subtle}"/>`)
      : [0, 1, 2].map((i) => `<rect x="20" y="${34 + i * 11}" width="${90 - i * 15}" height="4" rx="2" fill="${subtle}"/>`)
    contentSvg = `<circle cx="14" cy="37" r="2" fill="${primary}"/>`
      + lines.map((l, i) => `<circle cx="14" cy="${48 + i * 11}" r="2" fill="${primary}"/>` + l).join('')
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs><clipPath id="r${index}"><rect width="${W}" height="${H}" rx="5"/></clipPath></defs>
    <g clip-path="url(#r${index})">
      <rect width="${W}" height="${H}" fill="#FFFFFF"/>
      <rect x="0" y="0" width="${W}" height="16" fill="${primary}"/>
      <text x="8" y="11" font-family="${escapeXmlAttr(theme.font || 'sans-serif')}" font-size="7" font-weight="600" fill="${onPrimary}">${title}</text>
      ${contentSvg}
      <rect x="126" y="72" width="26" height="12" rx="3" fill="${primary}" opacity="0.85"/>
      <text x="139" y="81" text-anchor="middle" font-family="sans-serif" font-size="8" font-weight="700" fill="#FFFFFF">${index + 1}</text>
    </g>
  </svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
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
