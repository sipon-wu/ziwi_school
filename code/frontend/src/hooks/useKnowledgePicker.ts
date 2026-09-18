import type { TextbookStaticData, TextbookUnit } from "../lib/domain"
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useTeaching, GRADE_NAMES, type TeachingCtxValue } from '../lib/TeachingContext'
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
  currentUnits: TextbookUnit[]
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
  const [textbookData, setTextbookData] = useState<TextbookStaticData>(null)
  // 后端单元列表（2026-09-18，C3）：与 knowledge/nodes 同源、按当前教材收口
  const [backendUnits, setBackendUnits] = useState<TextbookUnit[]>([])

  useEffect(() => {
    // 当前教材上下文（2026-09-18，C3 收口）：把 学科/年级/册别 传给后端，由其解析 kg version_id。
    // 此前不带这些参数 → 接口返回**混合 28 个教材版本**的节点（实测），预选只能"取前 6 个"（与学科/年级无关）。
    const gradeName = GRADE_NAMES[teaching.grade - 1] || ''
    const volume = teaching.semester === '上' ? '上册' : teaching.semester === '下' ? '下册' : ''
    const ctx = `subject=${encodeURIComponent(teaching.subject || '')}&grade=${encodeURIComponent(gradeName)}&volume=${encodeURIComponent(volume)}`
    const load = async () => {
      // ── 知识点数据源：**优先读后端 DB**（2026-09-13 统一数据源）──
      // 此前读前端静态 JSON（`/knowledge-graph.json`：168 节点、字符串 ID 如 "m-1-1-1"），
      // 而后端生成查的是本库 tb_kg_node（5552 节点、int64 ID）→ **两套 ID 体系不同**，
      // 于是"前端选中的 ID"在后端**永远查不到**，前置链/知识面约束在真实操作下**从未生效**。
      // 现在选择器与后端同源；静态 JSON 仅作**接口不可用时的降级**（避免白屏）。
      let dbNodes: KnowledgeNode[] = []
      try {
        const res = await fetch(`/api/ai/knowledge/nodes?limit=2000&${ctx}`)
        if (res.ok) {
          const j = await res.json()
          dbNodes = (j.nodes || []).map((n: any) => ({
            id: String(n.id),                 // ← DB 的 int64（字符串化），与后端同源
            name: n.name || '',
            // 节点本身没有 subject/grade 列，但**本次请求是按当前教材收口的** → 用上下文回填，
            // 使下游按学科/年级的消费方（着色、筛选）拿到真实值而不是空串/0。
            subject: teaching.subject || '',
            grade: teaching.grade || 0,
            unit: n.unit || '',
            version_id: n.version_id || '',   // ← 教材版本**实体 ID**（溯源用，见 CoursewareBuilder）
            prerequisites: n.prerequisites || [],
            curriculum_code: '',
            difficulty: n.difficulty || '',
            cognitive: n.cognitive || '',
            parent_id: n.parent_id || null,
            next: [],
          })) as KnowledgeNode[]
        }
      } catch { /* 降级静态 JSON */ }

      if (dbNodes.length) {
        setKnowledgeData(dbNodes)
      } else {
        try {
          const kgRes = await fetch('/knowledge-graph.json')
          if (kgRes.ok) {
            const kg = await kgRes.json()
            setKnowledgeData(Array.isArray(kg) ? kg : [])
          }
        } catch { /* 静默降级 */ }
      }
      // ── 单元列表：优先后端（与 nodes 同源、按当前教材收口）──
      // 静态 textbook-math.json 实际**不存在于源码与部署产物**（2026-09-18 核实）→ 旧路径恒空，
      // 单元下拉一直是死的。现读后端；静态仅作降级。
      try {
        const uRes = await fetch(`/api/ai/knowledge/units?limit=200&${ctx}`)
        if (uRes.ok) {
          const uj = await uRes.json()
          const us = (uj.units || [])
            .filter((u: any) => u && String(u.unit || '').trim())
            .map((u: any) => ({ unit: String(u.unit), kps: [] as string[] }))
          setBackendUnits(us as TextbookUnit[])
        }
      } catch { /* 降级静态 JSON */ }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teaching.subject, teaching.grade, teaching.semester])

  // 某单元的全部节点 ID（后端单元只给 unit 名、不含 kps → 从已加载节点反查）
  const unitNodeIds = useCallback(
    (unit: string) => knowledgeData.filter((n) => n.unit === unit).map((n) => n.id),
    [knowledgeData],
  )

  // ── 当前教材单元列表 ──
  // 后端优先（按当前教材收口）；静态 JSON 仅降级（其文件实际不存在 → 恒空）
  const currentUnits = useMemo(() => {
    if (backendUnits.length) return backendUnits
    if (!textbookData) return []
    const version = textbookData[teaching.currentTextbook()] || {}
    return version[String(teaching.grade)]?.[teaching.semester] || []
  }, [backendUnits, textbookData, teaching.currentTextbook(), teaching.grade, teaching.semester])

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
    // 1) 单元路径：**后端单元**（按当前教材收口）优先；静态 textbook-math.json 仅降级（文件实际不存在）
    if (currentUnits.length > 0) {
      const firstUnit = currentUnits[0] as { unit: string; kps?: string[] }
      setSelectedUnit(firstUnit.unit)
      // 后端单元只给 unit 名（无 kps）→ 从已加载节点反查该单元节点，取前 6 个（与旧静态口径的粒度一致）
      const ids = firstUnit.kps?.length ? firstUnit.kps : unitNodeIds(firstUnit.unit)
      setSelectedIds(ids.slice(0, 6))
      return
    }
    // 2) 回退：教材映射缺失时，从知识图谱预选若干节点（保证「AI生成」按钮不因无预选而恒灰）。
    //    口径修正（2026-09-18，DECISIONS「预选过滤口径不一致」）：
    //    此前按 `n.subject === 学科` / `n.grade === 年级` / `n.semester === 学期` 过滤 —— 但这些字段在
    //    `tb_kg_node` 里**本就不存在**（接口固定返回 `subject:''`、`grade:0`、无 semester，见下方映射），
    //    于是过滤恒为空 → 落到「全库前 6 个节点」：预选出的知识点可能与当前学科/年级毫无关系（真缺陷）。
    //    现改为取**同一教材版本（version_id，后端确实返回）**内的节点做预选，保证口径内部自洽。
    //    待 `/api/ai/knowledge/units` 支持 年级/学期 维度后，再按年级收口（见 DECISIONS 待办 C3）。
    if (knowledgeData.length === 0) return
    const vid = String((knowledgeData[0] as { version_id?: string }).version_id || '')
    const sameVer = knowledgeData.filter((n) => String((n as { version_id?: string }).version_id || '') === vid)
    const pool = sameVer.length ? sameVer : knowledgeData
    const pick = pool.slice(0, 6).map((n) => n.id)
    if (pick.length > 0) setSelectedIds(pick)
  }, [textbookData, knowledgeData, teaching.currentTextbook(), teaching.grade, teaching.semester, currentUnits, autoSelect, preSelectedNodes])

  // ── 单元切换 ──
  const handleUnitChange = useCallback((unitName: string) => {
    setSelectedUnit(unitName)
    const unit = currentUnits.find((u: any) => u.unit === unitName) as { kps?: string[] } | undefined
    const ids = unit?.kps?.length ? unit.kps : unitNodeIds(unitName)
    setSelectedIds(ids.slice(0, 6))
  }, [currentUnits, unitNodeIds])

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
