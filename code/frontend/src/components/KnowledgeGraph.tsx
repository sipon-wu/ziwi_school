import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import G6, { type Graph, type GraphData, type TreeGraph } from '@antv/g6'

export interface KnowledgeNode {
  id: string; name: string; subject: string; grade: number; semester: string
  unit: string; difficulty: string; cognitive: string; curriculum_code: string
  parent_id: string | null; prerequisites: string[]; next: string[]
}

type LayoutMode = 'tree' | 'circular' | 'force'
type Dimension = 'knowledge' | 'cognitive' | 'difficulty' | 'curriculum'

interface Props { data: KnowledgeNode[]; subject?: string; selectedIds?: string[]; onSelect?: (ids: string[]) => void; className?: string; height?: number }

const DIFFICULTY_COLORS: Record<string, string> = { L1: '#52C41A', L2: '#1890FF', L3: '#FA8C16', L4: '#F5222D' }
const COGNITIVE_COLORS: Record<string, string> = { '记忆': '#B37FEB', '理解': '#5CDBD3', '应用': '#1890FF', '分析': '#FA8C16', '评价': '#F5222D', '创造': '#EB2F96' }
const DIM_COLORS: Record<string, string> = { tree: '#5B8FF9', circular: '#1890FF', force: '#1890FF' }
const FONT_SIZES = [14, 12, 11, 9, 8] // 层级字号递减

/** 树数据：年级→学期→单元→知识点 四层 */
function buildTreeData(nodes: KnowledgeNode[]): any {
  if (!nodes?.length) return { id: 'root', label: '暂无数据', children: [] }
  const byGrade = new Map<number, KnowledgeNode[]>()
  nodes.forEach(n => { const g = n.grade || 1; if (!byGrade.has(g)) byGrade.set(g, []); byGrade.get(g)!.push(n) })
  const sorted = Array.from(byGrade.keys()).sort((a, b) => a - b)
  return {
    id: 'root', label: nodes[0]?.subject || '',
    children: sorted.map(g => ({
      id: `g-${g}`, label: `${g}年级`, children:
        (() => { const bySem = new Map<string, KnowledgeNode[]>(); byGrade.get(g)!.forEach(n => { const s = n.semester || '上'; if (!bySem.has(s)) bySem.set(s, []); bySem.get(s)!.push(n) })
          return Array.from(bySem.keys()).map(s => ({ id: `s-${g}-${s}`, label: `${s}`, children:
            (() => { const byUnit = new Map<string, KnowledgeNode[]>(); bySem.get(s)!.forEach(n => { const u = n.unit || '其他'; if (!byUnit.has(u)) byUnit.set(u, []); byUnit.get(u)!.push(n) })
              return Array.from(byUnit.keys()).map(u => ({ id: `u-${g}-${s}-${u.slice(0,4)}`, label: u, children: byUnit.get(u)!.map(k => ({ id: k.id, label: k.name, data: k })), type: 'rect', size: [Math.min(u.length * 12 + 20, 160), 24], style: { fill: '#E8F0FE', stroke: '#5B8FF9', radius: 6 } }))
            })()
          , type: 'rect', size: [50, 20], style: { fill: '#F6BD16', stroke: '#F6BD16', radius: 6, fillOpacity: 0.9 } }))
        })()
    , type: 'rect', size: [70, 24], style: { fill: '#FF9845', stroke: '#FF9845', radius: 6, fillOpacity: 0.9 } })),
  }
}

/** 图数据：节点+边 */
function buildGraphData(nodes: KnowledgeNode[]): GraphData {
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const edges: any[] = []
  const added = new Set<string>()
  nodes.forEach(n => {
    n.next?.forEach(t => { if (nodeMap.has(t) && !added.has(n.id + t)) { edges.push({ source: n.id, target: t }); added.add(n.id + t) } })
    n.prerequisites?.forEach(p => { if (nodeMap.has(p) && !added.has(p + n.id)) { edges.push({ source: p, target: n.id }); added.add(p + n.id) } })
  })
  // 计算关联度作为边权重
  const deg = new Map<string, number>()
  edges.forEach(e => { deg.set(e.source, (deg.get(e.source) || 0) + 1); deg.set(e.target, (deg.get(e.target) || 0) + 1) })
  return {
    nodes: nodes.map(n => ({ id: n.id, label: n.name, data: n, degree: deg.get(n.id) || 0 })),
    edges: edges.map(e => {
      const w = Math.max(0.3, 1 - ((deg.get(e.source) || 0) + (deg.get(e.target) || 0)) / 10)
      return { ...e, weight: w }
    }),
  }
}

export default function KnowledgeGraph({ data = [], subject = '数学', selectedIds = [], onSelect, className = '', height = 500 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const graphRef = useRef<Graph | TreeGraph | null>(null)
  const [layout, setLayout] = useState<LayoutMode>('tree')
  const [dimension, setDimension] = useState<Dimension>('knowledge')
  const [difficultyRange, setDifficultyRange] = useState<[number, number]>([1, 4])
  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null)
  const [ready, setReady] = useState(false)

  const visibleNodes = useMemo(() =>
    data.filter(n => n.subject === subject).filter(n => { const d = parseInt(n.difficulty.replace('L', '')); return d >= difficultyRange[0] && d <= difficultyRange[1] }),
  [data, subject, difficultyRange])

  const colorByDimension = useCallback((node: KnowledgeNode): string => {
    if (dimension === 'difficulty') return DIFFICULTY_COLORS[node.difficulty] || '#1890FF'
    if (dimension === 'cognitive') return COGNITIVE_COLORS[node.cognitive] || '#1890FF'
    if (dimension === 'curriculum') return '#722ED1'
    return DIM_COLORS[layout] || '#5B8FF9'
  }, [dimension, layout])

  useEffect(() => { if (data.length > 0) setReady(true) }, [data])

  // 环形动态密度计算
  const calcCircularRadius = useCallback((count: number, w: number, h: number) => {
    // 节点越多半径越大，保证不重叠
    const baseR = Math.min(w, h) * 0.35
    const extraPerNode = 1.5
    return Math.min(baseR + count * extraPerNode, Math.min(w, h) * 0.6)
  }, [])

  useEffect(() => {
    if (!containerRef.current || visibleNodes.length === 0) return
    if (graphRef.current) { graphRef.current.destroy(); graphRef.current = null }

    const w = containerRef.current.clientWidth || 800
    const h = height || 500
    const colorMap = new Map<string, string>()
    visibleNodes.forEach(n => colorMap.set(n.id, colorByDimension(n)))

    let graph: Graph | TreeGraph

    if (layout === 'tree') {
      // ── 思维导图模式 ──
      const treeData = buildTreeData(visibleNodes)
      graph = new G6.TreeGraph({
        container: containerRef.current, width: w, height: h,
        fitView: true, fitViewPadding: [30, 60, 30, 60],
        modes: { default: ['drag-canvas', 'zoom-canvas', 'click-select'] },
        layout: {
          type: 'mindmap', direction: 'H',
          getHeight: () => 28, getWidth: (d: any) => (d.label?.length || 4) * 12 + 20,
          getVGap: () => 4, getHGap: () => 60,
        },
        defaultNode: {
          type: 'rect', size: [100, 28], style: { fill: '#5B8FF9', stroke: '#fff', lineWidth: 1.5, radius: 8, cursor: 'pointer', fillOpacity: 0.9 },
          labelCfg: { position: 'center', style: { fill: '#fff', fontSize: 11, fontFamily: 'PingFang SC' } },
        },
        defaultEdge: { type: 'cubic-horizontal', style: { stroke: '#91A0B0', lineWidth: 0.5, opacity: 0.25 } },
        animate: true, minZoom: 0.2, maxZoom: 3,
      })
      graph.data(treeData)
      graph.render()
      // 递归设置层级字号
      const setLevelStyle = (nodeId: string, level: number) => {
        const node = graph.findById(nodeId)
        if (!node) return
        const fontSize = FONT_SIZES[Math.min(level, FONT_SIZES.length - 1)]
        const isLeaf = !(node.getModel() as any).children?.length
        if (isLeaf) {
          graph.updateItem(node, { size: [(node.getModel() as any).label?.length * 12 + 24 || 80, 24], style: { fill: colorMap.get(nodeId) || '#5B8FF9', stroke: '#fff', fillOpacity: 0.9 }, labelCfg: { style: { fontSize } } })
        } else {
          graph.updateItem(node, { style: { fill: level === 1 ? '#FF9845' : level === 2 ? '#F6BD16' : '#5B8FF9' }, labelCfg: { style: { fontSize: FONT_SIZES[level] } } })
        }
        const children = (node.getModel() as any).children
        if (children) children.forEach((c: any) => setLevelStyle(c.id, level + 1))
      }
      setLevelStyle('root', 0)
    } else {
      // ── 环状 / 网状 ──
      const gData = buildGraphData(visibleNodes)
      const count = visibleNodes.length
      const r = calcCircularRadius(count, w, h)

      const layoutCfg = layout === 'circular'
        ? {
            type: 'circular' as const,
            radius: r,
            divisions: Math.ceil(count / 3),
            ordering: 'degree' as const,
          }
        : {
            type: 'force' as const,
            preventOverlap: true,
            nodeStrength: (d: any) => -30 - 10 * (d.data?.degree || 0),
            edgeStrength: 0.02,
            linkDistance: (d: any) => 30 + 40 * (1 - d.weight),
            nodeSpacing: 15,
            animate: true,
            alphaDecay: 0.005,
          }

      graph = new G6.Graph({
        container: containerRef.current, width: w, height: h,
        fitView: true, fitViewPadding: [30, 40, 30, 40],
        modes: { default: ['drag-canvas', 'zoom-canvas', 'drag-node', 'click-select'] },
        layout: layoutCfg,
        defaultNode: { size: 22, type: 'circle', style: { fill: '#5B8FF9', stroke: '#fff', lineWidth: 1.5, cursor: 'pointer' }, labelCfg: { position: 'bottom', offset: 4, style: { fill: '#333', fontSize: 9 } } },
        defaultEdge: { type: 'cubic', style: { stroke: '#91A0B0', lineWidth: 0.5, opacity: 0.25 } },
        animate: layout === 'force',
        minZoom: 0.2, maxZoom: 5,
      })
      graph.data(gData)
      graph.render()

      // 延迟着色
      const paintNodes = () => {
        graph.getNodes().forEach((node: any) => {
          const m = node.getModel() as any
          if (m?.data) graph.updateItem(node, { style: { fill: colorMap.get(m.data.id) || '#5B8FF9' } })
        })
      }
      if (layout === 'force') setTimeout(paintNodes, 300)
      else paintNodes()

      // 缩放事件：动态调整标签大小
      graph.on('viewportchange', () => {
        const zoom = graph.getZoom()
        const labelVisible = zoom > 0.4
        graph.getNodes().forEach((node: any) => {
          const m = node.getModel() as any
          if (m?.data) {
            graph.updateItem(node, {
              label: labelVisible ? (m?.data?.name?.length > 6 ? m.data.name.slice(0, 6) + '…' : m.data.name) : '',
              labelCfg: { style: { fontSize: Math.max(7, Math.min(11, 9 * zoom)) } },
            })
          }
        })
      })
    }

    // 通用事件
    const commonEvents = (g: Graph | TreeGraph) => {
      g.on('node:mouseenter', (e: any) => { const m = e.item?.getModel() as any; if (m?.data) g.updateItem(e.item, { style: { stroke: '#1890FF', lineWidth: 2, shadowBlur: 6 } }) })
      g.on('node:mouseleave', (e: any) => { const m = e.item?.getModel() as any; if (m?.data) g.updateItem(e.item, { style: { stroke: '#fff', lineWidth: 1.5, shadowBlur: 0 } }) })
      g.on('node:click', (e: any) => {
        const m = e.item?.getModel() as any
        if (m?.data) { setSelectedNode(m.data); onSelect?.(selectedIds.includes(m.data.id) ? selectedIds.filter(id => id !== m.data.id) : [...selectedIds, m.data.id]) }
      })
    }
    commonEvents(graph)
    graphRef.current = graph as any

    const onResize = () => {
      if (graphRef.current && containerRef.current) {
        graphRef.current.changeSize(containerRef.current.clientWidth, height || 500)
        graphRef.current.fitView(20)
      }
    }
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('resize', onResize); graphRef.current?.destroy(); graphRef.current = null }
  }, [visibleNodes, layout, dimension, colorByDimension, height, selectedIds, onSelect, ready, calcCircularRadius])

  const allNodes = data.filter(n => n.subject === subject)

  return (
    <div className={`relative bg-white rounded-xl border border-gray-200 overflow-hidden ${className}`}>
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
        <div className="flex gap-1 bg-white/90 rounded-lg p-1 shadow-sm border border-gray-100">
          {(['tree', 'circular', 'force'] as LayoutMode[]).map(m => (
            <button key={m} onClick={() => { setDimension('knowledge'); setLayout(m) }} className={`px-2 py-1 text-[11px] rounded transition-colors ${layout === m ? 'bg-brand text-white' : 'text-gray-500 hover:bg-gray-100'}`}>{m === 'tree' ? '思维导图' : m === 'circular' ? '环状' : '网状'}</button>
          ))}
        </div>
        <div className="flex gap-1 bg-white/90 rounded-lg p-1 shadow-sm border border-gray-100">
          {(['knowledge', 'cognitive', 'difficulty', 'curriculum'] as Dimension[]).map(d => (
            <button key={d} onClick={() => setDimension(d)} className={`px-2 py-1 text-[11px] rounded transition-colors ${dimension === d ? 'bg-brand text-white' : 'text-gray-500 hover:bg-gray-100'}`}>{d === 'knowledge' ? '知识点' : d === 'cognitive' ? '能力' : d === 'difficulty' ? '难度' : '课标'}</button>
          ))}
        </div>
      </div>
      <div className="absolute top-2 right-2 z-10 bg-white/90 rounded-lg px-2 py-1.5 shadow-sm border border-gray-100 flex items-center gap-1.5 text-[11px]">
        <span className="text-gray-400">L1</span><input type="range" min={1} max={4} value={difficultyRange[0]} onChange={e => setDifficultyRange([Number(e.target.value), Math.max(Number(e.target.value), difficultyRange[1])])} className="w-12 h-1 accent-brand" />
        <span className="text-gray-400">—</span><input type="range" min={1} max={4} value={difficultyRange[1]} onChange={e => setDifficultyRange([Math.min(difficultyRange[0], Number(e.target.value)), Number(e.target.value)])} className="w-12 h-1 accent-brand" />
        <span className="text-gray-400">L4</span>
      </div>
      <div ref={containerRef} style={{ width: '100%', height: height || 500 }} />
      <div className="absolute bottom-2 right-2 z-10 flex gap-1">
        <button onClick={() => graphRef.current?.fitView(20)} className="px-2 py-1 text-[11px] bg-white/90 rounded shadow-sm border border-gray-100 hover:bg-gray-50">适应画布</button>
        <button onClick={() => graphRef.current?.zoomTo(1, { x: 0, y: 0 })} className="px-2 py-1 text-[11px] bg-white/90 rounded shadow-sm border border-gray-100 hover:bg-gray-50">重置</button>
      </div>
      {allNodes.length === 0 && (<div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">加载中...</div>)}
      {selectedNode && (<div className="absolute bottom-2 left-2 z-10 bg-white rounded-lg shadow-lg border border-gray-200 p-3 max-w-[240px] text-xs"><div className="font-semibold text-sm text-gray-900 mb-1">{selectedNode.name}</div><div className="text-gray-500 space-y-0.5"><div>{selectedNode.grade}年级·{selectedNode.semester}学期·{selectedNode.unit}</div><div>难度:<span style={{color:DIFFICULTY_COLORS[selectedNode.difficulty]}}>{selectedNode.difficulty}</span></div><div>认知:{selectedNode.cognitive}</div></div></div>)}
      {dimension !== 'knowledge' && (<div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex gap-2 text-[10px] bg-white/90 rounded-lg px-2 py-1 shadow-sm border border-gray-100">{dimension === 'difficulty' && Object.entries(DIFFICULTY_COLORS).map(([k,v]) => <span key={k} className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{background:v}}/>{k}</span>)}{dimension === 'cognitive' && Object.entries(COGNITIVE_COLORS).slice(0,4).map(([k,v]) => <span key={k} className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{background:v}}/>{k}</span>)}</div>)}
    </div>
  )
}
