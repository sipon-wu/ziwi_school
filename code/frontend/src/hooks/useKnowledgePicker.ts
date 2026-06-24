import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTeaching, type TeachingState } from '../lib/TeachingContext'
import type { KnowledgeNode } from '../components/KnowledgeGraph'

type LayoutMode = 'tree' | 'spiral' | 'mesh'
type Dimension = 'knowledge' | 'cognitive' | 'difficulty' | 'curriculum'

export interface UseKnowledgePickerOptions {
  /** 初始预选的节点 ID（联动传入，优先级最高） */
  preSelectedNodes?: string[]
  /** 是否自动按教材单元预选知识点（默认 true） */
  autoSelect?: boolean
}

export interface UseKnowledgePickerReturn {
  // 原始数据
  knowledgeData: KnowledgeNode[]
  loading: boolean

  // 教材单元映射
  textbookData: any | null
  currentUnits: { unit: string; kps: string[] }[]
  selectedUnit: string
  handleUnitChange: (unitName: string) => void

  // 选中状态
  selectedIds: string[]
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>
  selectedNodes: KnowledgeNode[]

  // 图谱展示控制
  showGraph: boolean
  setShowGraph: React.Dispatch<React.SetStateAction<boolean>>
  showGraphModal: boolean
  setShowGraphModal: React.Dispatch<React.SetStateAction<boolean>>

  graphLayout: LayoutMode
  setGraphLayout: React.Dispatch<React.SetStateAction<LayoutMode>>
  graphDimension: Dimension
  setGraphDimension: React.Dispatch<React.SetStateAction<Dimension>>
  diffRange: [number, number]
  setDiffRange: React.Dispatch<React.SetStateAction<[number, number]>>

  // 教材信息（来自 TeachingContext）
  teaching: TeachingState & {
    setSubject: (s: '语文' | '数学' | '英语') => void
    setGrade: (g: number) => void
    setSemester: (s: '上' | '下') => void
    setTextbookMath: (v: string) => void
    setTextbookEnglish: (v: string) => void
    setProgress: (unit: string, lesson: string, pct: number) => void
    reset: () => void
  }
}

/**
 * 共享知识点选取器 Hook
 *
 * 出题页（ExerciseGenerator）和教案页（LessonPlanEditor）共同使用。
 * 管理知识图谱数据加载、教材单元映射、缺省自动预选、选中状态、
 * 图谱展示参数（布局/着色维度/难度范围/inline-modal 切换）。
 */
export function useKnowledgePicker(options: UseKnowledgePickerOptions = {}): UseKnowledgePickerReturn {
  const { preSelectedNodes, autoSelect = true } = options
  const teaching = useTeaching()

  // ── 数据加载 ──
  const [knowledgeData, setKnowledgeData] = useState<KnowledgeNode[]>([])
  const [loading, setLoading] = useState(true)
  const [textbookData, setTextbookData] = useState<any>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const [kgRes, tbRes] = await Promise.all([
          fetch('/knowledge-graph.json'),
          fetch('/textbook-math.json'),
        ])
        const kg = await kgRes.json()
        const tb = await tbRes.json()
        setKnowledgeData(kg)
        setTextbookData(tb)
      } catch { /* 静默降级 */ }
      setLoading(false)
    }
    load()
  }, [])

  // ── 当前教材单元列表 ──
  const currentUnits = useMemo(() => {
    if (!textbookData) return []
    const version = textbookData[teaching.textbook_math] || {}
    return version[String(teaching.grade)]?.[teaching.semester] || []
  }, [textbookData, teaching.textbook_math, teaching.grade, teaching.semester])

  // ── 当前选中单元 ──
  const [selectedUnit, setSelectedUnit] = useState('')

  // ── 选中状态 ──
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // ── 图谱展示控制 ──
  const [showGraph, setShowGraph] = useState(false)
  const [showGraphModal, setShowGraphModal] = useState(false)
  const [graphLayout, setGraphLayout] = useState<LayoutMode>('tree')
  const [graphDimension, setGraphDimension] = useState<Dimension>('knowledge')
  const [diffRange, setDiffRange] = useState<[number, number]>([1, 4])

  // ── 自动预选：首次加载 + 教材版本/年级/学期变更时 ——
  const prevPreSelectedRef = React.useRef<string[] | undefined>(undefined)
  const autoSelectInitRef = React.useRef(false)
  useEffect(() => {
    // preSelectedNodes 优先级最高（联动传入）
    if (preSelectedNodes && preSelectedNodes.length > 0) {
      // 仅当 preSelectedNodes 变化时才覆盖
      const prev = prevPreSelectedRef.current
      const same = prev && prev.length === preSelectedNodes.length && prev.every((id, i) => id === preSelectedNodes[i])
      if (!same) {
        prevPreSelectedRef.current = preSelectedNodes
        setSelectedIds(preSelectedNodes)
      }
      return
    }
    if (!autoSelect || !textbookData || currentUnits.length === 0) return
    // 教材/年级/学期变更时重新自动预选（匹配现有 ExerciseGenerator 行为）
    autoSelectInitRef.current = true
    const firstUnit = currentUnits[0]
    setSelectedUnit(firstUnit.unit)
    setSelectedIds(firstUnit.kps || [])
  }, [textbookData, teaching.textbook_math, teaching.grade, teaching.semester, currentUnits, autoSelect, preSelectedNodes])

  // ── 单元切换 ──
  const handleUnitChange = useCallback((unitName: string) => {
    setSelectedUnit(unitName)
    const unit = currentUnits.find((u: any) => u.unit === unitName)
    if (unit?.kps) setSelectedIds(unit.kps)
  }, [currentUnits])

  // ── 选中节点详情 ──
  const selectedNodes = useMemo(
    () => knowledgeData.filter(n => selectedIds.includes(n.id)),
    [knowledgeData, selectedIds],
  )

  return {
    knowledgeData,
    loading,
    textbookData,
    currentUnits,
    selectedUnit,
    handleUnitChange,
    selectedIds,
    setSelectedIds,
    selectedNodes,
    showGraph,
    setShowGraph,
    showGraphModal,
    setShowGraphModal,
    graphLayout,
    setGraphLayout,
    graphDimension,
    setGraphDimension,
    diffRange,
    setDiffRange,
    teaching,
  }
}
