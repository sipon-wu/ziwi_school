import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Graph, treeToGraphData } from '@antv/g6'
import { useIsMobile } from '@/hooks/useMediaQuery'

export interface KnowledgeNode {
  id: string; name: string; subject: string; grade: number; semester: string
  unit: string; difficulty: string; cognitive: string; curriculum_code: string
  parent_id: string | null; prerequisites: string[]; next: string[]
  [key: string]: unknown
}

type LayoutMode = 'tree' | 'spiral' | 'mesh'
type Dimension = 'knowledge' | 'cognitive' | 'difficulty' | 'curriculum'

interface Props {
  data: KnowledgeNode[]
  subject?: string
  grade?: number
  semester?: string
  textbook?: string
  selectedIds?: string[]
  onSelect?: (ids: string[]) => void
  onClose?: () => void
  inline?: boolean
  height?: number
  layoutMode?: LayoutMode; onLayoutChange?: (m: LayoutMode) => void
  colorDimension?: Dimension; onDimensionChange?: (d: Dimension) => void
  diffRange?: [number, number]; onDiffRangeChange?: (r: [number, number]) => void
}

const DIFFICULTY_COLORS: Record<string, string> = { L1: '#52C41A', L2: '#1890FF', L3: '#FA8C16', L4: '#F5222D' }
const COGNITIVE_COLORS: Record<string, string> = { '记忆': '#B37FEB', '理解': '#5CDBD3', '应用': '#1890FF', '分析': '#FA8C16', '评价': '#F5222D', '创造': '#EB2F96' }
const GRADE_NAMES = ['一年级','二年级','三年级','四年级','五年级','六年级','七年级','八年级','九年级']

/** 构建纯知识点依赖树 */
function buildKnowledgeTree(nodes: KnowledgeNode[]): any {
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const childrenMap = new Map<string, KnowledgeNode[]>()
  const visited = new Set<string>()

  nodes.forEach(n => {
    ;(n.prerequisites || []).forEach(p => {
      if (nodeMap.has(p)) {
        if (!childrenMap.has(p)) childrenMap.set(p, [])
        if (!childrenMap.get(p)!.find(c => c.id === n.id)) childrenMap.get(p)!.push(n)
      }
    })
  })

  const roots = nodes.filter(n => !(n.prerequisites || []).some(p => nodeMap.has(p)))

  const build = (node: KnowledgeNode): any => {
    if (visited.has(node.id)) return null
    visited.add(node.id)
    const children = (childrenMap.get(node.id) || []).map(c => build(c)).filter(Boolean)
    return { id: node.id, children: children.length > 0 ? children : undefined }
  }

  const tree = roots.map(r => build(r)).filter(Boolean)
  return { id: '__virtual_root__', children: tree.length > 0 ? tree : nodes.slice(0, 1).map(n => ({ id: n.id })) }
}

/** 构建图数据 */
function buildGraphData(nodes: KnowledgeNode[]) {
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const edges: { source: string; target: string; weight: number }[] = []
  const added = new Set<string>()
  nodes.forEach(n => {
    ;(n.next || []).forEach(t => { if (nodeMap.has(t) && !added.has(n.id + t)) { edges.push({ source: n.id, target: t, weight: 1 }); added.add(n.id + t) } })
    ;(n.prerequisites || []).forEach(p => { if (nodeMap.has(p) && !added.has(p + n.id)) { edges.push({ source: p, target: n.id, weight: 1 }); added.add(p + n.id) } })
  })
  const deg = new Map<string, number>()
  edges.forEach(e => { deg.set(e.source, (deg.get(e.source) || 0) + 1); deg.set(e.target, (deg.get(e.target) || 0) + 1) })
  return {
    nodes: nodes.map(n => ({ id: n.id, data: n, degree: deg.get(n.id) || 0 })),
    edges: edges.map(e => ({ source: e.source, target: e.target, weight: Math.max(0.3, 1 - ((deg.get(e.source) || 0) + (deg.get(e.target) || 0)) / 10) })),
  }
}

export default function KnowledgeGraph({
  data = [], subject = '数学', grade, semester, textbook,
  selectedIds = [], onSelect, onClose, inline = false, height,
  layoutMode, onLayoutChange,
  colorDimension, onDimensionChange,
  diffRange, onDiffRangeChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const graphRef = useRef<Graph | null>(null)
  const [layout, setLayout] = useState<LayoutMode>(layoutMode || 'tree')
  const [dimension, setDimension] = useState<Dimension>(colorDimension || 'knowledge')
  const [difficultyRange, setDifficultyRange] = useState<[number, number]>(diffRange || [1, 4])
  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null)
  const [showSelectedSheet, setShowSelectedSheet] = useState(false)
  const graphHeight = height || 600
  const isMobile = useIsMobile()

  // 受控模式：同步外部状态
  useEffect(() => { if (layoutMode) setLayout(layoutMode) }, [layoutMode])
  useEffect(() => { if (colorDimension) setDimension(colorDimension) }, [colorDimension])
  useEffect(() => { if (diffRange) setDifficultyRange(diffRange) }, [diffRange])

  const handleLayout = (m: LayoutMode) => { setLayout(m); onLayoutChange?.(m) }
  const handleDimension = (d: Dimension) => { setDimension(d); onDimensionChange?.(d) }
  const handleDiffRange = (r: [number, number]) => { setDifficultyRange(r); onDiffRangeChange?.(r) }

  const visibleNodes = useMemo(() =>
    data
      .filter(n => n.subject === subject)
      .filter(n => {
        if (grade == null) return true
        const sv = (s: string) => s === '上' ? 1 : 2
        const cs = semester ? sv(semester) : 2
        if (n.grade < grade) return true
        if (n.grade === grade) return sv(n.semester) <= cs
        return false
      })
      .filter(n => { const d = parseInt(n.difficulty.replace('L', '')); return d >= difficultyRange[0] && d <= difficultyRange[1] }),
  [data, subject, grade, semester, difficultyRange])

  const getColor = useCallback((node: KnowledgeNode): string => {
    if (dimension === 'difficulty') return DIFFICULTY_COLORS[node.difficulty] || '#1890FF'
    if (dimension === 'cognitive') return COGNITIVE_COLORS[node.cognitive] || '#1890FF'
    if (dimension === 'curriculum') return '#722ED1'
    return '#5B8FF9'
  }, [dimension])

  // 已选节点详情
  const selectedNodes = useMemo(() => data.filter(n => selectedIds.includes(n.id)), [data, selectedIds])
  const removeSelected = (id: string) => onSelect?.(selectedIds.filter(i => i !== id))

  useEffect(() => {
    if (!containerRef.current || visibleNodes.length === 0) return
    if (graphRef.current) { graphRef.current.destroy(); graphRef.current = null }

    const w = containerRef.current.clientWidth || 800
    const h = graphHeight
    const colorMap = new Map<string, string>()
    visibleNodes.forEach(n => colorMap.set(n.id, getColor(n)))

    let graph: Graph

    if (layout === 'tree') {
      const treeJson = buildKnowledgeTree(visibleNodes)
      const gData = treeToGraphData(treeJson)

      graph = new Graph({
        container: containerRef.current, width: w, height: h, autoFit: 'view', data: gData,
        node: {
          type: 'rect',
          style: (d: any) => {
            const node = visibleNodes.find(n => n.id === d.id)
            const label = d.id === '__virtual_root__' ? '知识点' : node?.name || d.id
            const w2 = Math.max(label.length * 14 + 36, 72)
            return {
              labelText: label,
              labelPlacement: 'center',
              labelFontSize: 12,
              labelFill: '#fff',
              size: [w2, 30],
              fill: colorMap.get(d.id) || '#5B8FF9',
              stroke: '#fff',
              lineWidth: 1.5,
              radius: 8,
              cursor: 'pointer',
            }
          },
          animation: { enter: false },
        },
        edge: {
          type: 'cubic-horizontal',
          style: { stroke: '#C0C8D4', lineWidth: 1.5, opacity: 0.5 },
          animation: { enter: false },
        },
        layout: { type: 'mindmap', direction: 'H', getHeight: () => 32, getWidth: (d: any) => (d.id === '__virtual_root__' ? 100 : (visibleNodes.find(n => n.id === d.id)?.name?.length || 4) * 13 + 32), getHGap: () => 40, getVGap: () => 6 },
        behaviors: ['drag-canvas', 'zoom-canvas', 'collapse-expand'],
      })
      graph.render()
      setTimeout(() => graph.fitView(), 100)
    } else {
      const gData = buildGraphData(visibleNodes)
      const isSpiral = layout === 'spiral'

      graph = new Graph({
        container: containerRef.current, width: w, height: h, data: gData, autoFit: 'view',
        node: {
          style: (d: any) => {
            const name = d.data?.name || d.id
            return {
              labelText: name,
              labelPlacement: 'bottom',
              labelOffsetY: 4,
              labelFontSize: 12,
              labelFill: '#333',
              size: 28,
              fill: colorMap.get(d.id) || '#5B8FF9',
              stroke: '#fff',
              lineWidth: 1.5,
              cursor: 'pointer',
            }
          },
        },
        edge: { style: { stroke: '#C0C8D4', lineWidth: (d: any) => Math.max(0.3, d.weight * 0.8), opacity: 0.35 } },
        layout: isSpiral
          ? { type: 'circular', startRadius: 20, endRadius: Math.max(200, Math.min(visibleNodes.length * 18, Math.min(w, h) * 0.45)) }
          : {
              type: 'd3-force',
              collide: { radius: 20 },
              linkDistance: (d: any) => 60 + 60 * (1 - (d.weight || 0.5)),
              nodeStrength: (d: any) => -40 - 10 * (d.degree || 0),
              edgeStrength: 0.02,
              alphaDecay: 0.003,
            },
        behaviors: isSpiral ? ['drag-canvas', 'zoom-canvas', 'drag-element'] : ['drag-canvas', 'zoom-canvas', 'drag-element'],
      })
      graph.render()
    }

    graph.on('node:click', (evt: any) => {
      const id = evt.target?.id
      if (!id || id === '__virtual_root__') return
      const node = visibleNodes.find(n => n.id === id)
      if (node) {
        setSelectedNode(node)
        onSelect?.(selectedIds.includes(id) ? selectedIds.filter(i => i !== id) : [...selectedIds, id])
      }
    })

    graphRef.current = graph

    if (!inline) {
      const onResize = () => {
        if (graphRef.current && containerRef.current)
          graphRef.current.setSize(containerRef.current.clientWidth, window.innerHeight - 180)
      }
      window.addEventListener('resize', onResize)
      return () => { window.removeEventListener('resize', onResize); graphRef.current?.destroy(); graphRef.current = null }
    }
    return () => { graphRef.current?.destroy(); graphRef.current = null }
  }, [visibleNodes, layout, dimension, getColor, selectedIds, onSelect, graphHeight, inline])

  const gradeLabel = grade ? GRADE_NAMES[grade - 1] || '' : ''
  const summary = `${subject || ''} · ${gradeLabel}${semester || ''}学期 · ${textbook || ''}`

  // 工具栏（移动端增大触摸目标至 44px）
  const toolbar = (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1 bg-white/95 rounded-lg p-1 shadow-sm border border-gray-100">
        {(['tree', 'spiral', 'mesh'] as LayoutMode[]).map(m => (
          <button key={m} onClick={() => { handleDimension('knowledge'); handleLayout(m) }}
            className={`${isMobile ? 'px-3 py-2 text-xs min-w-[44px] min-h-[36px]' : 'px-2 py-1 text-[11px]'} rounded transition-colors ${layout === m ? 'bg-brand text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
            {m === 'tree' ? '树状' : m === 'spiral' ? '螺旋' : '网状'}
          </button>
        ))}
      </div>
      <div className="flex gap-1 bg-white/95 rounded-lg p-1 shadow-sm border border-gray-100">
        {(['knowledge', 'cognitive', 'difficulty', 'curriculum'] as Dimension[]).map(d => (
          <button key={d} onClick={() => handleDimension(d)}
            className={`${isMobile ? 'px-2 py-2 text-[11px] min-w-[44px] min-h-[36px]' : 'px-2 py-1 text-[11px]'} rounded transition-colors ${dimension === d ? 'bg-brand text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
            {d === 'knowledge' ? '知识点' : d === 'cognitive' ? '能力' : d === 'difficulty' ? '难度' : '课标'}
          </button>
        ))}
      </div>
    </div>
  )

  // 难度范围：Pointer Events 统一触摸 + 鼠标
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragSide, setDragSide] = useState<'left' | 'right' | null>(null)
  const leftPct = (difficultyRange[0] - 1) / 3
  const rightPct = (difficultyRange[1] - 1) / 3

  // 拖拽视觉位置（不取整，丝滑）
  const [dragPct, setDragPct] = useState<number | null>(null)
  // 全局拖拽事件（Pointer Events 统一触摸和鼠标）
  useEffect(() => {
    if (!dragSide || !trackRef.current) return
    const track = trackRef.current
    const onMove = (e: PointerEvent) => {
      e.preventDefault()
      const rect = track.getBoundingClientRect()
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      setDragPct(pct)
      const raw = 1 + Math.round(pct * 3)
      if (dragSide === 'left') {
        if (raw < difficultyRange[1]) handleDiffRange([raw, difficultyRange[1]])
      } else {
        if (raw > difficultyRange[0]) handleDiffRange([difficultyRange[0], raw])
      }
    }
    const onUp = () => { setDragSide(null); setDragPct(null) }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [dragSide, difficultyRange, handleDiffRange])

  // 移动端滑块尺寸更大
  const sliderW = isMobile ? 24 : 12
  const sliderH = isMobile ? 36 : 18
  const sliderArrowH = isMobile ? 16 : 8

  const diffSlider = (
    <div ref={trackRef} className="bg-white/95 rounded-lg px-5 py-3 shadow-sm border border-gray-100 select-none touch-none" style={{ width: isMobile ? '100%' : 200 }}>
      <div className="relative" style={{ height: isMobile ? 44 : 32 }}>
        {/* 刻度线 */}
        <div className="absolute w-px bg-gray-300 pointer-events-none" style={{ left: 0, top: 5, height: 14 }} />
        <div className="absolute w-px bg-gray-300 pointer-events-none" style={{ left: `${100}%`, top: 5, height: 14 }} />
        <div className="absolute w-px bg-gray-300 pointer-events-none" style={{ left: `${33.33}%`, top: 9, height: 6 }} />
        <div className="absolute w-px bg-gray-300 pointer-events-none" style={{ left: `${66.67}%`, top: 9, height: 6 }} />

        {/* 轴 */}
        <div className="absolute left-0 right-0 bg-gray-200 rounded-full pointer-events-none" style={{ top: isMobile ? 18 : 12, height: isMobile ? 2 : 1 }} />
        {/* 选中区间高亮 */}
        <div className="absolute bg-brand rounded-full pointer-events-none" style={{ left: `${leftPct * 100}%`, right: `${(1 - rightPct) * 100}%`, top: isMobile ? 18 : 12, height: isMobile ? 3 : 1 }} />

        {/* 标签 */}
        <span className="absolute text-[10px] text-gray-400 pointer-events-none" style={{ left: isMobile ? -20 : -16, top: isMobile ? 28 : 18 }}>L1</span>
        <span className="absolute text-[10px] text-gray-400 pointer-events-none" style={{ right: isMobile ? -20 : -16, top: isMobile ? 28 : 18 }}>L4</span>

        {/* 左三角滑块 */}
        <div className="absolute cursor-grab active:cursor-grabbing transition-[left] duration-75 ease-out"
          style={{ left: `calc(${(dragSide === 'left' && dragPct != null ? dragPct : leftPct) * 100}% - ${sliderW / 2}px)`, top: -(sliderH / 2 - 2), width: sliderW, height: sliderH }}
          onPointerDown={e => { e.preventDefault(); (e.target as HTMLElement).setPointerCapture(e.pointerId); setDragSide('left') }}>
          <svg width={sliderW} height={sliderArrowH} style={{ display: 'block', margin: '0 auto' }}>
            <polygon points={`0,0 ${sliderW},0 ${sliderW / 2},${sliderArrowH}`} fill={dragSide === 'left' ? '#2B5DA8' : '#A0A0A0'} />
          </svg>
        </div>

        {/* 右三角滑块 */}
        <div className="absolute cursor-grab active:cursor-grabbing transition-[left] duration-75 ease-out"
          style={{ left: `calc(${(dragSide === 'right' && dragPct != null ? dragPct : rightPct) * 100}% - ${sliderW / 2}px)`, top: -(sliderH / 2 - 2), width: sliderW, height: sliderH }}
          onPointerDown={e => { e.preventDefault(); (e.target as HTMLElement).setPointerCapture(e.pointerId); setDragSide('right') }}>
          <svg width={sliderW} height={sliderArrowH} style={{ display: 'block', margin: '0 auto' }}>
            <polygon points={`0,0 ${sliderW},0 ${sliderW / 2},${sliderArrowH}`} fill={dragSide === 'right' ? '#2B5DA8' : '#A0A0A0'} />
          </svg>
        </div>
      </div>
    </div>
  )

  // 画布内容
  const canvas = (
    <>
      <div ref={containerRef} className="w-full h-full min-h-[300px]" />
      {dimension !== 'knowledge' && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex gap-2 text-[10px] bg-white/95 rounded-lg px-2 py-1 shadow-sm border border-gray-100">
          {dimension === 'difficulty' && Object.entries(DIFFICULTY_COLORS).map(([k, v]) => <span key={k} className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: v }} />{k}</span>)}
          {dimension === 'cognitive' && Object.entries(COGNITIVE_COLORS).slice(0, 4).map(([k, v]) => <span key={k} className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: v }} />{k}</span>)}
        </div>
      )}
      <div className="absolute bottom-3 right-3 z-10 flex gap-1">
        <button onClick={() => graphRef.current?.fitView()} className="px-2.5 py-1.5 text-[11px] bg-white/95 rounded-lg shadow-sm border border-gray-100 hover:bg-gray-50">适应画布</button>
        <button onClick={() => graphRef.current?.zoomTo(1)} className="px-2.5 py-1.5 text-[11px] bg-white/95 rounded-lg shadow-sm border border-gray-100 hover:bg-gray-50">重置</button>
      </div>
      {selectedNode && (
        <div className="absolute bottom-3 left-3 z-10 bg-white rounded-xl shadow-lg border border-gray-200 p-3 max-w-[240px] text-xs">
          <div className="font-semibold text-sm text-gray-900 mb-1">{selectedNode.name}</div>
          <div className="text-gray-500 space-y-0.5">
            <div>{selectedNode.grade}年级·{selectedNode.semester}学期·{selectedNode.unit}</div>
            <div>难度:<span style={{ color: DIFFICULTY_COLORS[selectedNode.difficulty] }}>{selectedNode.difficulty}</span></div>
            <div>认知:{selectedNode.cognitive}</div>
          </div>
        </div>
      )}
      {visibleNodes.length === 0 && <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">当前筛选条件下暂无知识点</div>}
    </>
  )

  // ── 内嵌模式 ──
  if (inline) {
    return (
      <div className="relative bg-gray-50/50" style={{ height: graphHeight || 420 }}>
        <div className="absolute top-3 left-3 z-10">{toolbar}</div>
        <div className="absolute top-3 right-3 z-10">{diffSlider}</div>
        {canvas}
      </div>
    )
  }

  // ── 弹窗模式（响应式：桌面端居中弹窗，移动端全屏）──
  return (
    <>
      <style>{'.xw-chat-btn{display:none!important}'}</style>
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center lg:p-4" onClick={onClose}>
      <div
        className={`w-full h-full bg-white shadow-2xl flex flex-col overflow-hidden ${
          isMobile ? 'rounded-none' : 'max-w-[1400px] max-h-[95vh] rounded-2xl'
        }`}
        onClick={e => e.stopPropagation()}
      >
        {/* 顶部栏（移动端精简） */}
        <div className={`flex items-center justify-between border-b border-gray-100 bg-gray-50 shrink-0 ${isMobile ? 'px-3 py-2' : 'px-5 py-3'}`}>
          {isMobile ? (
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span className="font-semibold text-sm text-gray-800">知识点图谱</span>
              {selectedIds.length > 0 && <span className="text-brand font-medium">已选{selectedIds.length}个</span>}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-800">知识点图谱</span>
              <span className="text-[12px] text-gray-400">|</span>
              <span className="text-[12px] text-gray-500">{summary}</span>
              <span className="text-[12px] text-gray-400">|</span>
              <span className="text-[12px] text-gray-500">难度 {difficultyRange[0] === difficultyRange[1] ? `L${difficultyRange[0]}` : `L${difficultyRange[0]}–L${difficultyRange[1]}`}</span>
              <span className="text-[12px] text-gray-400">|</span>
              <span className="text-[12px] text-gray-500">{visibleNodes.length} 个知识点</span>
              {selectedIds.length > 0 && <><span className="text-[12px] text-gray-400">|</span><span className="text-[12px] text-brand font-medium">已选 {selectedIds.length} 个</span></>}
            </div>
          )}
          <button onClick={onClose} className={`hover:bg-gray-200 rounded-lg ${isMobile ? 'p-2' : 'p-1.5'}`}>
            <svg width={isMobile ? 20 : 16} height={isMobile ? 20 : 16} viewBox="0 0 16 16" fill="none"><path d="M4 4L12 12M12 4L4 12" stroke="#999" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div className="flex-1 relative bg-gray-50/50">
          {/* 左侧工具栏 */}
          <div className={`absolute z-10 ${isMobile ? 'top-2 left-2' : 'top-3 left-3'}`}>{toolbar}</div>

          {/* 右侧/底部：难度+已选考点 */}
          {isMobile ? (
            <>
              {/* 移动端：难度滑块浮在右上方 */}
              <div className="absolute top-2 right-2 z-10" style={{ width: 'calc(100% - 180px)', minWidth: 160 }}>
                {diffSlider}
              </div>
              {/* 移动端底部分页签 */}
              {selectedNodes.length > 0 && (
                <button
                  onClick={() => setShowSelectedSheet(!showSelectedSheet)}
                  className="absolute bottom-3 left-3 right-3 z-10 bg-white rounded-xl shadow-lg border border-gray-200 px-4 py-2.5 flex items-center justify-between active:bg-gray-50"
                >
                  <span className="text-xs font-medium text-gray-700">
                    已选考点 ({selectedNodes.length})
                  </span>
                  <span className="text-[10px] text-brand">{showSelectedSheet ? '收起' : '查看'}</span>
                </button>
              )}
              {/* 已选考点底部Sheet */}
              {showSelectedSheet && selectedNodes.length > 0 && (
                <div className="absolute bottom-14 left-3 right-3 z-20 bg-white rounded-t-xl shadow-2xl border border-gray-200 animate-slide-up max-h-[40vh] overflow-y-auto">
                  <div className="sticky top-0 bg-white px-4 py-2.5 border-b border-gray-100 flex items-center justify-between rounded-t-xl">
                    <span className="text-xs font-semibold text-gray-600">已选考点</span>
                    <button onClick={() => setShowSelectedSheet(false)} className="text-gray-400 hover:text-gray-600">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </button>
                  </div>
                  <div className="p-2 space-y-1">
                    {selectedNodes.map(n => (
                      <div key={n.id} className="flex items-center gap-2 text-xs py-2 px-2 bg-brand/5 rounded">
                        <span className="text-gray-700 truncate flex-1">{n.name}</span>
                        <button onClick={() => removeSelected(n.id)} className="text-gray-400 hover:text-red-500 shrink-0 p-1">
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* 桌面端：右侧浮动面板 */
            <div className="absolute top-3 right-3 z-10 flex flex-col gap-2 items-end">
              {diffSlider}
              {selectedNodes.length > 0 && (
                <div className="bg-white/95 rounded-lg shadow-sm border border-gray-100 p-2 max-h-[200px] overflow-y-auto min-w-[160px]">
                  <div className="text-[11px] font-semibold text-gray-600 mb-1.5 px-1">已选考点</div>
                  <div className="space-y-1">
                    {selectedNodes.map(n => (
                      <div key={n.id} className="flex items-center gap-1.5 text-xs py-1 px-1.5 bg-brand/5 rounded group">
                        <span className="text-gray-700 truncate flex-1">{n.name.length > 8 ? n.name.slice(0, 8) + '…' : n.name}</span>
                        <button onClick={() => removeSelected(n.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {canvas}
        </div>
      </div>
    </div>
    </>
  )
}
