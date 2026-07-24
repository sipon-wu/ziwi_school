import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useTeaching, type TeachingCtxValue } from '../lib/TeachingContext'
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
  teaching: TeachingCtxValue & {
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
  // teaching 由 TeachingProvider 每渲染返回新对象引用，这里用 ref 持有最新值，
  // 避免其引用不稳定污染下方 picker 对象的记忆化（否则每次渲染都返回新对象，
  // 导致注册到 KGContext 的 useEffect([picker]) 无限重跑 = Maximum update depth）。
  const teachingRef = useRef(teaching)
  teachingRef.current = teaching

  // ── 数据加载 ──
  const [knowledgeData, setKnowledgeData] = useState<KnowledgeNode[]>([])
  const [loading, setLoading] = useState(true)
  const [textbookData, setTextbookData] = useState<any>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const kgRes = await fetch('/knowledge-graph.json')
        if (kgRes.ok) {
          const kg = await kgRes.json()
          setKnowledgeData(Array.isArray(kg) ? kg : [])
        }
      } catch { /* 静默降级 */ }
      try {
        const tbRes = await fetch('/textbook-math.json')
        if (tbRes.ok) {
          const tb = await tbRes.json()
          setTextbookData(tb)
        }
      } catch { /* 静默降级 */ }
      setLoading(false)
    }
    load()
  }, [])

  // ── 当前教材单元列表 ──
  const currentUnits = useMemo(() => {
    if (!textbookData) return []
    const version = textbookData[teaching.currentTextbook()] || {}
    return version[String(teaching.grade)]?.[teaching.semester] || []
  }, [textbookData, teaching.currentTextbook(), teaching.grade, teaching.semester])

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

  // ── 自动预选：教材映射优先；缺失时回退知识图谱按学科预选（保证出题/教案按钮默认可用）──
  const prevPreSelectedRef = useRef<string[] | undefined>(undefined)
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
    if (!autoSelect) return
    // 1) 教材版本映射路径（textbook-math.json 存在且含当前 版本/年级/学期 组合）
    if (textbookData && currentUnits.length > 0) {
      const firstUnit = currentUnits[0]
      setSelectedUnit(firstUnit.unit)
      setSelectedIds(firstUnit.kps || [])
      return
    }
    // 2) 回退：textbook-math.json 缺失/不含当前组合时，按 学科/年级/学期 从知识图谱预选前若干节点，
    //    避免「AI生成」按钮因无预选知识点而恒灰（灰度指引：知识点为可选，不应阻塞出题/教案）。
    if (knowledgeData.length === 0) return
    const subj = teaching.subject
    const grade = teaching.grade
    const sem = teaching.semester
    let cand = knowledgeData.filter((n: any) => n.subject === subj)
    if (cand.length === 0) cand = knowledgeData
    const sameGS = cand.filter((n: any) => n.grade === grade && n.semester === sem)
    const pick = (sameGS.length ? sameGS : cand).slice(0, 6).map((n: any) => n.id)
    if (pick.length > 0) setSelectedIds(pick)
  }, [textbookData, knowledgeData, teaching.currentTextbook(), teaching.grade, teaching.semester, currentUnits, autoSelect, preSelectedNodes])

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

  // 记忆化返回对象：依赖仅为本 hook 自身状态/记忆值（不含不稳定的 teaching 引用），
  // 使 picker 引用在无关重渲染时保持稳定，根治注册到 KGContext 时的无限循环。
  return useMemo(() => ({
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
    teaching: teachingRef.current,
  }), [
    knowledgeData, loading, textbookData, currentUnits, selectedUnit, handleUnitChange,
    selectedIds, setSelectedIds, selectedNodes, showGraph, setShowGraph,
    showGraphModal, setShowGraphModal, graphLayout, setGraphLayout,
    graphDimension, setGraphDimension, diffRange, setDiffRange,
  ])
}
