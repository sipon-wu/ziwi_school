/**
 * 知识图谱工具组件 — 类型定义
 * 独立于任何页面逻辑，纯工具组件
 */

/** 知识点节点 */
export interface KnowledgeNode {
  id: string
  name: string
  subject: string
  grade: number
  semester: string
  unit: string
  difficulty: string
  cognitive: string
  curriculum_code: string
  parent_id: string | null
  prerequisites: string[]
  next: string[]
  [key: string]: unknown
}

/** 布局模式 */
export type LayoutMode = 'tree' | 'spiral' | 'mesh'

/** 着色维度 */
export type ColorDimension = 'knowledge' | 'cognitive' | 'difficulty' | 'curriculum'

/** 过滤参数 — 外部传入，决定哪些节点可见 */
export interface FilterParams {
  subject: string
  grade?: number
  semester?: string
  difficultyRange?: [number, number]
}

/** 工具组件 Props */
export interface KnowledgeGraphToolProps {
  /** 全量知识点数据（外部加载后传入） */
  data: KnowledgeNode[]
  /** 过滤参数 */
  filter: FilterParams
  /** 受控：当前选中 ID 列表 */
  selectedIds: string[]
  /** 选中变更回调 */
  onSelect: (ids: string[]) => void
}
