/**
 * 领域类型契约（Domain Contracts）· **单一事实源**（2026-09-16）
 *
 * 为什么有这个文件：体检发现全仓 `any` 457 处，其中很大一部分不是"偷懒"，
 * 而是**领域对象根本没有名字** —— 同一个结构在 5~9 个文件里各写一遍内联类型
 * （例如"任教班级"的内联类型重复 7 次、`safeGetUser` 重复实现 4 次），
 * 于是没人知道该引谁，只能 `any` 或就地复制。
 *
 * 本文件收敛**跨文件共享**的领域结构与取数口径；产品内部的局部类型仍留在各自文件。
 * 原则：
 *   1. 只定义**事实结构**（代码里已经在传的形状），不发明新概念；
 *   2. 类型之外，凡"取数口径"也属于契约（如 `pickClassLabel`），一并收在此处；
 *   3. 类型导入一律 `import type`（编译期擦除，不产生运行时循环依赖）。
 */
import type { MaterialItem } from './api'

/* ───────────────── 任教班级 ───────────────── */

/** 任教班级（`/api/my-classes` 返回项；此前在 7 个文件各写一遍内联类型） */
export interface MyClass {
  class_id: string
  class_name: string
  grade: string
  subject: string
  is_primary: boolean
}

export interface MyClassesResp {
  items: MyClass[]
}

/**
 * 班级展示名：**选中班级 → 主班级 → 留空**（口径见 DECISIONS 09-15「班级 ≠ 年级」）。
 * 注意：拿不到班级时**返回空串**（由信息卡显示"—"），绝不用年级顶替。
 */
export function pickClassLabel(classes: MyClass[], selectedId?: string | null): string {
  const hit = classes.find(it => it.class_id === selectedId)
    || classes.find(it => it.is_primary)
    || classes[0]
  return hit?.class_name || ''
}

/** 登录响应（`/auth/login`）：此前为 `any`，导致 `token`/`user` 全链路无类型 */
export interface AuthLoginResp {
  token: string
  user?: AuthUser
}

/* ───────────────── 登录用户 ───────────────── */

/** localStorage 里的登录用户（`zhiwei_user` / `user` 两个键兼容） */
export interface AuthUser {
  id?: string
  name?: string
  role?: string
  school_id?: string
  school_name?: string
  license_status?: string
}

/** 唯一实现：此前 `safeGetUser` 在 4 个文件各写一遍，且返回 `any`（`JSON.parse` 结果） */
export function safeGetUser(): AuthUser {
  try {
    return (JSON.parse(localStorage.getItem('zhiwei_user') || localStorage.getItem('user') || '{}') || {}) as AuthUser
  } catch {
    return {}
  }
}

/* ───────────────── 生成配方 / 溯源 ───────────────── */

/** 发散边界（受控发散模型：轨道 / 边缘 / 是否允许越档） */
export interface Divergence {
  label?: string
  level?: string
  orbit?: number
  edge?: number
  beyond_band?: boolean
}

/** 生成配方（服务端回传，随草稿落库；编辑器左栏「来源」据此显示） */
export interface ScopeResolved {
  source?: 'teacher' | 'kg' | string
  prereq_source?: string
  divergence?: Divergence
  knowledge_points?: string[]
  unit?: string
  model?: string
  textbook_version_id?: string
  textbook_version_name?: string
}

/**
 * 生成接口 / 素材落库里承载配方的那层壳。
 * 注：`textbook_version_id/name` 是**壳这一层**的字段（与 `scope_resolved` 平级），
 * 不是 `scope_resolved` 内部字段 —— 此前靠 `as any` 才读得到，这里补进契约。
 */
export interface ScopeResolvedPayload {
  scope_resolved: ScopeResolved | null
  textbook_version_id?: string
  textbook_version_name?: string
}

/* ───────────────── 课件素材 ───────────────── */

/**
 * 课件素材（`MaterialItem` 只有素材库通用字段，缺课件专有字段 ——
 * 这正是各处对课件数据 `as any` 的原因，这里补齐）。
 */
export interface CoursewareMaterial extends MaterialItem {
  status?: string
  subject?: string
  grade?: string
  content?: string
  h5_html?: string
  updated_at?: string
  user_id?: string
  scope_resolved?: ScopeResolved | null
  /** 创建类接口偶尔把 body 再包一层 { data }（调用点 `saveRes?.id || saveRes?.data?.id`） */
  data?: { id?: string; [key: string]: unknown }
}

/**
 * 课件生成响应（`/ai/courseware/generate`）。
 * 此前 `request<any>` → 调用点十余处 `(res as any).xxx` 取值，既无类型也无字段名保护。
 * 字段按**代码实际读取**的形状声明（全部可选，服务端演进时不至于编译失败）。
 */
export interface CoursewareGenerateResp {
  courseware_markdown?: string
  markdown?: string
  h5_html?: string
  outline?: unknown[]
  color_palette?: unknown
  style_tag?: string
  style_profile?: string
  theme_id?: string
  scope_resolved?: ScopeResolved | null
  textbook_version_name?: string
  /** 发散地图（编辑器"发散度"面板）；此前靠 `any` 才读得到 */
  divergence_map?: unknown[]
  /** 相似素材 / 推荐参照（编辑器"参照课件"）；同上 */
  similar_material?: unknown
  /** 推荐参照素材（字符串 ID 列表 —— 消费方 `setMaterialRefs` 是 `string[]`，此前被 any 掩盖） */
  recommended_refs?: string[]
}

/* ───────────────── 复用既有导出（避免二处定义） ───────────────── */

export type { CwSlide, OutlineSlide, H5Component } from './exportPptx'

/* ───────────────── 题目 / 试卷（0703 §4.1 八要素 / §4.2 组卷） ───────────────── */

export interface QuestionItem {
  id?: string
  stem?: string
  /** 题面正文（部分链路用 `content` 而非 `stem`，两个字段都在用） */
  content?: string
  answer?: string
  analysis?: string
  qtype?: string
  score?: number
  knowledge?: string[]
  level?: string
  source?: string
  discrimination?: number
  status?: string
  usage_count?: number
}

export interface ExamPaper {
  id?: string
  title?: string
  subject?: string
  grade?: string
  status?: string
  total_score?: number
  duration?: number
  /** 考试时长（分钟）—— 与 `duration` 并存，两个字段都在用（ExamEditor 读取） */
  duration_minutes?: number
  updated_at?: string
  sections?: unknown[]
  questions?: QuestionItem[] | string
}

/* ───────────────── 参照相近课件 / 教材静态数据 ───────────────── */

export interface SimilarMaterial {
  id?: string
  name?: string
  score?: number
}

/** 教材单元（静态数据最内层）；`unit`(名称) 必填、`kps`(知识点) 可选 —— 由 `UseKnowledgePickerReturn` 反推 */
export interface TextbookUnit {
  unit: string
  kps?: string[]
  name?: string
  [key: string]: unknown
}

export type TextbookStaticData = Record<string, Record<string, Record<string, TextbookUnit[]>>> | null

/* ───────────────── 设置页编辑目标 ───────────────── */

export interface SettingsEditTarget {
  id: string
  name?: string
  [key: string]: unknown
}

/* ───────────────── 教案 ───────────────── */

export interface LessonPlanItem {
  id?: string
  title?: string
  lesson_title?: string
  subject?: string
  grade?: string
  status?: string
  content?: string
  textbook_unit?: string
  format_template?: string
  /** 后端可能返回字符串（如 "2"），消费方须自行 Number() 收敛 */
  period?: string | number
  /** 互审状态：approved / returned / pending（定稿锁定判定用到） */
  review_status?: string
  /** 课标对齐：JSON 字符串，消费方 JSON.parse */
  curriculum_alignments?: string
  ai_model_version?: string
  /** 已挂载课件引用：JSON 字符串或数组（两种都要兼容） */
  material_refs?: string | unknown[]
  /** 知识点 ID：JSON 字符串或数组（保存时 stringify，回显时 parse） */
  knowledge_node_ids?: string | unknown[]
  updated_at?: string
  created_at?: string
  /** 部分接口会把 body 再包一层 { data } */
  data?: { id?: string; [key: string]: unknown }
}

/* ───────────────── 学校 / 班级 ───────────────── */

export interface SchoolItem {
  id?: string
  name?: string
  full_name?: string
  short_name?: string
  license_status?: string
}

/** 学校查询（认领）结果：比 SchoolItem 多一个 `found` 标记 */
export interface SchoolLookupResult {
  found?: boolean
  school?: SchoolItem
  [key: string]: unknown
}

export interface ClassItem {
  id?: string
  class_id?: string
  name?: string
  grade?: string
  subject?: string
}

/* ───────────────── AI 生成类响应（按代码实际读取字段声明） ───────────────── */

export interface LessonPlanGenerateResp {
  markdown?: string
  content?: string
  lesson_plan?: unknown
  outline?: unknown[]
  similar_material?: SimilarMaterial | null
  recommended_refs?: string[]
  /** 课标对齐（JSON 字符串，渲染前 parse） */
  curriculum_alignments?: string
  /** 生成模型名（回显到「生成模型」位） */
  model?: string
  /** 生成耗时（ms） */
  generation_time_ms?: number
  /** 推荐挂载课件（消费方 `setMaterialRefs` 是 `string[]` → 实际是字符串数组，此前被 any 掩盖） */
  material_refs?: string[]
  /** AI 推荐的适宜课件列表（与 material_refs 不同：这是"建议清单"） */
  recommended_materials?: string[]
}

export interface CoursewareConsultResp {
  questions?: string[]
  consult_questions?: string[]
}

/** 校验问题项（0703 红线校验闸；字段以 `NoticeCenter` / 编辑器实际读取为准） */
export interface ValidateIssue {
  level: string
  message: string
  suggestion?: string
}

export interface CoursewareValidateResp {
  valid?: boolean
  /** 部分校验接口用 `pass` 而非 `valid`（NoticeCenter 走这条） */
  pass?: boolean
  issues?: ValidateIssue[]
  report?: unknown
}

export interface CoursewareTrimResp {
  trimmed_markdown?: string
  divergence_map?: unknown[]
}

export interface RenderResp {
  url?: string
  file?: string
  filename?: string
}

export interface VideoScriptResp {
  shots?: unknown[]
  script?: unknown
  markdown?: string
}

export interface ChatResp {
  reply?: string
  content?: string
  answer?: string
  suggestions?: string[]
  data?: { reply?: string; [key: string]: unknown }
}
