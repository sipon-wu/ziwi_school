import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import G6, { type Graph, type GraphData, type TreeGraphData } from '@antv/g6'

export interface KnowledgeNode {
  id: string; name: string; subject: string; grade: number; semester: string
  unit: string; difficulty: string; cognitive: string; curriculum_code: string
  parent_id: string | null; prerequisites: string[]; next: string[]
}

type LayoutMode = 'tree' | 'circular' | 'force'
type Dimension = 'knowledge' | 'cognitive' | 'difficulty' | 'curriculum'

interface Props { data: KnowledgeNode[]; grade?: number; subject?: string; selectedIds?: string[]; onSelect?: (ids: string[]) => void; className?: string; height?: number }

const DIFFICULTY_COLORS: Record<string, string> = { L1: '#52C41A', L2: '#1890FF', L3: '#FA8C16', L4: '#F5222D' }
const COGNITIVE_COLORS: Record<string, string> = { '记忆': '#B37FEB', '理解': '#5CDBD3', '应用': '#1890FF', '分析': '#FA8C16', '评价': '#F5222D', '创造': '#EB2F96' }
const DIFFICULTY_WEIGHT: Record<string, number> = { L1: 20, L2: 24, L3: 28, L4: 32 }

/** 按 年级→学期→单元→知识点 四层树 */
function buildTreeData(nodes: KnowledgeNode[]): TreeGraphData {
  if (!nodes || nodes.length === 0) return { id: 'root', label: '暂无数据', children: [] }
  const byGrade = new Map<number, KnowledgeNode[]>()
  nodes.forEach(n => { const g = n.grade || 1; if (!byGrade.has(g)) byGrade.set(g, []); byGrade.get(g)!.push(n) })
  const sorted = Array.from(byGrade.keys()).sort((a, b) => a - b)
  const gradeChildren: any[] = sorted.map(g => {
    const bySem = new Map<string, KnowledgeNode[]>()
    byGrade.get(g)!.forEach(n => { const s = n.semester || '上'; if (!bySem.has(s)) bySem.set(s, []); bySem.get(s)!.push(n) })
    const semChildren: any[] = Array.from(bySem.keys()).map(s => {
      const byUnit = new Map<string, KnowledgeNode[]>()
      bySem.get(s)!.forEach(n => { const u = n.unit || '其他'; if (!byUnit.has(u)) byUnit.set(u, []); byUnit.get(u)!.push(n) })
      const unitChildren: any[] = Array.from(byUnit.keys()).map(u => ({
        id: `u-${g}-${s}-${u.slice(0, 4)}`, label: u.length > 10 ? u.slice(0, 10) + '…' : u, children: byUnit.get(u)!.map(k => ({ id: k.id, label: k.name.length > 8 ? k.name.slice(0, 8) + '…' : k.name, data: k, size: DIFFICULTY_WEIGHT[k.difficulty] || 24 })), style: { fill: '#5B8FF9', stroke: '#5B8FF9', fillOpacity: 0.9 }, type: 'rect', size: [100, 22], labelCfg: { position: 'center', style: { fill: '#fff', fontSize: 9 } },
      }))
      return { id: `s-${g}-${s}`, label: `${s}学期`, children: unitChildren, style: { fill: '#F6BD16', stroke: '#F6BD16', fillOpacity: 0.9 }, type: 'rect', size: [80, 24], labelCfg: { position: 'center', style: { fill: '#fff', fontSize: 10, fontWeight: 700 } } }
    })
    return { id: `g-${g}`, label: `${g}年级`, children: semChildren, style: { fill: '#FF9845', stroke: '#FF9845', fillOpacity: 0.9 }, type: 'rect', size: [80, 26], labelCfg: { position: 'center', style: { fill: '#fff', fontSize: 11, fontWeight: 700 } } }
  })
  return { id: 'root', label: `${nodes[0]?.subject || ''}知识体系`, children: gradeChildren as any }
}

function buildGraphData(nodes: KnowledgeNode[]): GraphData {
  const filtered = [...nodes]
  const nodeMap = new Map(filtered.map(n => [n.id, n]))
  const edges: any[] = []
  filtered.forEach(n => { n.next?.forEach(t => { if (nodeMap.has(t)) edges.push({ source: n.id, target: t }) }) })
  return { nodes: filtered.map(n => ({ id: n.id, label: n.name, data: n, size: DIFFICULTY_WEIGHT[n.difficulty] || 22 })), edges }
}

export default function KnowledgeGraph({ data = [], subject = '数学', selectedIds = [], onSelect, className = '', height = 500 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const graphRef = useRef<Graph | null>(null)
  const [layout, setLayout] = useState<LayoutMode>('tree')
  const [dimension, setDimension] = useState<Dimension>('knowledge')
  const [difficultyRange, setDifficultyRange] = useState<[number, number]>([1, 4])
  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null)
  const [ready, setReady] = useState(false)

  // 过滤节点
  const visibleNodes = useMemo(() =>
    data.filter(n => n.subject === subject && (() => { const d = parseInt(n.difficulty.replace('L', '')); return d >= difficultyRange[0] && d <= difficultyRange[1] })()),
    [data, subject, difficultyRange]
  )

  const colorByDimension = useCallback((node: KnowledgeNode): string => {
    if (dimension === 'difficulty') return DIFFICULTY_COLORS[node.difficulty] || '#1890FF'
    if (dimension === 'cognitive') return COGNITIVE_COLORS[node.cognitive] || '#1890FF'
    if (dimension === 'curriculum') return '#722ED1'
    return '#5B8FF9'
  }, [dimension])

  // 数据就绪标记
  useEffect(() => { if (data.length > 0) setReady(true) }, [data])

  // 渲染图谱
  useEffect(() => {
    if (!containerRef.current) return
    if (graphRef.current) { graphRef.current.destroy(); graphRef.current = null }
    const nodes = data.filter(n => n.subject === subject)
    if (nodes.length === 0) return

    const container = containerRef.current
    const w = container.clientWidth || 800
    const h = height || 500

    const gData: any = layout === 'tree' ? buildTreeData(nodes) : buildGraphData(nodes)

    const graph = new G6.Graph({
      container,
      width: w, height: h,
      fitView: true,
      fitViewPadding: [20, 40, 20, 40],
      modes: { default: ['drag-canvas', 'zoom-canvas', 'drag-node', 'click-select'] },
      layout: layout === 'tree'
        ? { type: 'compactBox', direction: 'LR', getWidth: (d: any) => (d.size?.[0] || 80), getHeight: () => 24, getVGap: () => 4, getHGap: () => 30 }
        : layout === 'circular'
          ? { type: 'circular', radius: Math.min(w, h) * 0.38, divisions: 5 }
          : { type: 'force', preventOverlap: true, nodeStrength: -80, edgeStrength: 0.03, nodeSpacing: 50 },
      defaultNode: { size: 22, style: { fill: '#5B8FF9', stroke: '#fff', lineWidth: 1.5, cursor: 'pointer' }, labelCfg: { position: 'bottom', offset: 4, style: { fill: '#333', fontSize: 9 } } },
      // 极细 + 75%透明连线
      defaultEdge: { type: layout === 'tree' ? 'cubic-vertical' : 'cubic', style: { stroke: '#91A0B0', lineWidth: 0.5, opacity: 0.25, endArrow: { path: G6.Arrow.triangle(2, 4, 0), fill: '#91A0B0', opacity: 0.25 } } },
      animate: true,
      minZoom: 0.2, maxZoom: 3,
    })

    const colorMap = new Map<string, string>()
    nodes.forEach(n => colorMap.set(n.id, colorByDimension(n)))

    graph.data(gData as any)
    graph.render()

    if (layout !== 'tree') {
      graph.getNodes().forEach((node: any) => {
        const m = node.getModel() as any
        if (m?.data) graph.updateItem(node, { style: { fill: colorMap.get(m.data.id) || '#5B8FF9' }, size: (DIFFICULTY_WEIGHT[m.data.difficulty] || 22), label: m.data.name?.length > 6 ? m.data.name.slice(0, 6) + '…' : m.data.name })
      })
    } else {
      graph.getNodes().forEach((node: any) => {
        const m = node.getModel() as any
        if (m?.data) graph.updateItem(node, { style: { fill: colorMap.get(m.data.id) || '#5B8FF9' }, size: (DIFFICULTY_WEIGHT[m.data.difficulty] || 22) })
      })
    }

    graph.on('node:mouseenter', (e: any) => { const m = e.item?.getModel() as any; if (m?.data) graph.updateItem(e.item, { style: { stroke: '#1890FF', lineWidth: 2, shadowColor: '#1890FF', shadowBlur: 6 } }) })
    graph.on('node:mouseleave', (e: any) => { const m = e.item?.getModel() as any; if (m?.data) graph.updateItem(e.item, { style: { stroke: '#fff', lineWidth: 1.5, shadowBlur: 0 } }) })
    graph.on('node:click', (e: any) => {
      const m = e.item?.getModel() as any
      if (m?.data) { setSelectedNode(m.data); onSelect?.(selectedIds.includes(m.data.id) ? selectedIds.filter(id => id !== m.data.id) : [...selectedIds, m.data.id]) }
    })

    graphRef.current = graph
    const onResize = () => { if (graphRef.current && containerRef.current) { graphRef.current.changeSize(containerRef.current.clientWidth, height || 500); graphRef.current.fitView(20) } }
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('resize', onResize); if (graphRef.current) { graphRef.current.destroy(); graphRef.current = null } }
  }, [visibleNodes, layout, dimension, colorByDimension, height, selectedIds, onSelect, data, subject, ready])

  const allNodes = data.filter(n => n.subject === subject)

  return (
    <div className={`relative bg-white rounded-xl border border-gray-200 overflow-hidden ${className}`}>
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
        <div className="flex gap-1 bg-white/90 rounded-lg p-1 shadow-sm border border-gray-100">
          {(['tree', 'circular', 'force'] as LayoutMode[]).map(m => (
            <button key={m} onClick={() => { setDimension('knowledge'); setLayout(m) }} className={`px-2 py-1 text-[11px] rounded transition-colors ${layout === m ? 'bg-brand text-white' : 'text-gray-500 hover:bg-gray-100'}`}>{m === 'tree' ? '树状' : m === 'circular' ? '环状' : '网状'}</button>
          ))}
        </div>
        <div className="flex gap-1 bg-white/90 rounded-lg p-1 shadow-sm border border-gray-100">
          {(['knowledge', 'cognitive', 'difficulty', 'curriculum'] as Dimension[]).map(d => (
            <button key={d} onClick={() => setDimension(d)} className={`px-2 py-1 text-[11px] rounded transition-colors ${dimension === d ? 'bg-brand text-white' : 'text-gray-500 hover:bg-gray-100'}`}>{d === 'knowledge' ? '知识点' : d === 'cognitive' ? '能力' : d === 'difficulty' ? '难度' : '课标'}</button>
          ))}
        </div>
      </div>
      <div className="absolute top-2 right-2 z-10 bg-white/90 rounded-lg px-2 py-1.5 shadow-sm border border-gray-100 flex items-center gap-1.5 text-[11px]">
        <span className="text-gray-400">L1</span><input type="range" min={1} max={4} value={difficultyRange[0]} onChange={e => setDifficultyRange([Number(e.target.value), Math.max(Number(e.target.value), difficultyRange[1])])} className="w-12 h-1 accent-brand" /><span className="text-gray-400">—</span><input type="range" min={1} max={4} value={difficultyRange[1]} onChange={e => setDifficultyRange([Math.min(difficultyRange[0], Number(e.target.value)), Number(e.target.value)])} className="w-12 h-1 accent-brand" /><span className="text-gray-400">L4</span>
      </div>
      <div ref={containerRef} style={{ width: '100%', height: height || 500 }} />
      <div className="absolute bottom-2 right-2 z-10 flex gap-1">
        <button onClick={() => graphRef.current?.fitView(20)} className="px-2 py-1 text-[11px] bg-white/90 rounded shadow-sm border border-gray-100 hover:bg-gray-50">适应画布</button>
        <button onClick={() => graphRef.current?.zoomTo(1, { x: 0, y: 0 })} className="px-2 py-1 text-[11px] bg-white/90 rounded shadow-sm border border-gray-100 hover:bg-gray-50">重置</button>
      </div>
      {allNodes.length === 0 && (<div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">加载中...</div>)}
      {selectedNode && (<div className="absolute bottom-2 left-2 z-10 bg-white rounded-lg shadow-lg border border-gray-200 p-3 max-w-[240px] text-xs"><div className="font-semibold text-sm text-gray-900 mb-1">{selectedNode.name}</div><div className="text-gray-500 space-y-0.5"><div>{selectedNode.grade}年级·{selectedNode.semester}学期·{selectedNode.unit}</div><div>难度:<span style={{color:DIFFICULTY_COLORS[selectedNode.difficulty]}}>{selectedNode.difficulty}</span></div><div>认知:{selectedNode.cognitive}</div>{selectedNode.curriculum_code&&<div>课标:{selectedNode.curriculum_code}</div>}</div></div>)}
      {dimension !== 'knowledge' && (<div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex gap-2 text-[10px] bg-white/90 rounded-lg px-2 py-1 shadow-sm border border-gray-100">{dimension === 'difficulty' && Object.entries(DIFFICULTY_COLORS).map(([k,v]) => <span key={k} className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{background:v}}/>{k}</span>)}{dimension === 'cognitive' && Object.entries(COGNITIVE_COLORS).slice(0,4).map(([k,v]) => <span key={k} className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{background:v}}/>{k}</span>)}</div>)}
    </div>
  )
}
