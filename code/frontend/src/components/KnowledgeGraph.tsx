import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import G6, { type Graph, type GraphData, type TreeGraph, type TreeGraphData } from '@antv/g6'

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
const DIFFICULTY_WEIGHT: Record<string, number> = { L1: 18, L2: 22, L3: 26, L4: 30 }

/** 四层树：年级→学期→单元→知识点 */
function buildTreeData(nodes: KnowledgeNode[]): TreeGraphData {
  if (!nodes?.length) return { id: 'root', label: '暂无数据', children: [] }
  const byGrade = new Map<number, KnowledgeNode[]>()
  nodes.forEach(n => { const g = n.grade || 1; if (!byGrade.has(g)) byGrade.set(g, []); byGrade.get(g)!.push(n) })
  const sorted = Array.from(byGrade.keys()).sort((a, b) => a - b)
  const children = sorted.map(g => {
    const bySem = new Map<string, KnowledgeNode[]>()
    byGrade.get(g)!.forEach(n => { const s = n.semester || '上'; if (!bySem.has(s)) bySem.set(s, []); bySem.get(s)!.push(n) })
    const semChildren = Array.from(bySem.keys()).map(s => {
      const byUnit = new Map<string, KnowledgeNode[]>()
      bySem.get(s)!.forEach(n => { const u = n.unit || '其他'; if (!byUnit.has(u)) byUnit.set(u, []); byUnit.get(u)!.push(n) })
      const unitChildren = Array.from(byUnit.keys()).map(u => ({
        id: `u-${g}-${s}-${u.slice(0, 4)}`, label: u.length > 10 ? u.slice(0, 10) + '…' : u,
        children: byUnit.get(u)!.map(k => ({ id: k.id, label: k.name, data: k })),
      }))
      return { id: `s-${g}-${s}`, label: `${s}学期`, children: unitChildren }
    })
    return { id: `g-${g}`, label: `${g}年级`, children: semChildren }
  })
  return { id: 'root', label: `${nodes[0]?.subject || ''}知识体系`, children: children as any }
}

function buildGraphData(nodes: KnowledgeNode[]): GraphData {
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const edges: any[] = []
  nodes.forEach(n => { n.next?.forEach(t => { if (nodeMap.has(t)) edges.push({ source: n.id, target: t }) }) })
  return { nodes: nodes.map(n => ({ id: n.id, label: n.name, data: n })), edges }
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
    return '#5B8FF9'
  }, [dimension])

  useEffect(() => { if (data.length > 0) setReady(true) }, [data])

  // 渲染图谱
  useEffect(() => {
    if (!containerRef.current || visibleNodes.length === 0) return
    if (graphRef.current) { graphRef.current.destroy(); graphRef.current = null }

    const w = containerRef.current.clientWidth || 800
    const h = height || 500
    const colorMap = new Map<string, string>()
    visibleNodes.forEach(n => colorMap.set(n.id, colorByDimension(n)))

    // ── 树状：用 TreeGraph ──
    if (layout === 'tree') {
      const treeData = buildTreeData(visibleNodes)
      const g = new G6.TreeGraph({
        container: containerRef.current,
        width: w, height: h,
        fitView: true, fitViewPadding: [20, 40, 20, 40],
        modes: { default: ['drag-canvas', 'zoom-canvas', 'click-select'] },
        layout: { type: 'compactBox', direction: 'LR', getId: (d: any) => d.id, getHeight: () => 22, getWidth: (d: any) => d.label?.length * 10 + 20, getVGap: () => 4, getHGap: () => 50 },
        defaultNode: { size: 20, style: { fill: '#5B8FF9', stroke: '#fff', lineWidth: 1.5, cursor: 'pointer' }, labelCfg: { position: 'bottom', offset: 3, style: { fill: '#333', fontSize: 9 } } },
        defaultEdge: { type: 'cubic-vertical', style: { stroke: '#91A0B0', lineWidth: 0.5, opacity: 0.25 } },
        animate: true,
        minZoom: 0.2, maxZoom: 3,
      })
      g.data(treeData)
      g.render()
      g.getNodes().forEach((node: any) => {
        const m = node.getModel() as any
        if (m?.data) g.updateItem(node, { style: { fill: colorMap.get(m.data.id) || '#5B8FF9' }, size: DIFFICULTY_WEIGHT[m.data.difficulty] || 20 })
      })
      g.on('node:mouseenter', (e: any) => { const m = e.item?.getModel() as any; if (m?.data) g.updateItem(e.item, { style: { stroke: '#1890FF', lineWidth: 2, shadowBlur: 6 } }) })
      g.on('node:mouseleave', (e: any) => { const m = e.item?.getModel() as any; if (m?.data) g.updateItem(e.item, { style: { stroke: '#fff', lineWidth: 1.5, shadowBlur: 0 } }) })
      g.on('node:click', (e: any) => { const m = e.item?.getModel() as any; if (m?.data) { setSelectedNode(m.data); onSelect?.(selectedIds.includes(m.data.id) ? selectedIds.filter(id => id !== m.data.id) : [...selectedIds, m.data.id]) } })
      graphRef.current = g as any
    } else {
      // ── 环状 / 网状：用普通 Graph ──
      const gData = buildGraphData(visibleNodes)
      const layoutCfg = layout === 'circular'
        ? {
            type: 'concentric' as const,  // 环套环
            minNodeSpacing: 30,
            sortBy: 'grade' as const,
          }
        : {
            type: 'force' as const,
            preventOverlap: true,
            nodeStrength: -100,
            edgeStrength: 0.03,
            nodeSpacing: 55,
            animate: true,
            alphaDecay: 0.01,  // 慢衰减，节点渐变出现
          }

      const g = new G6.Graph({
        container: containerRef.current,
        width: w, height: h,
        fitView: true, fitViewPadding: [20, 40, 20, 40],
        modes: { default: ['drag-canvas', 'zoom-canvas', 'drag-node', 'click-select'] },
        layout: layoutCfg,
        defaultNode: { size: 20, style: { fill: '#5B8FF9', stroke: '#fff', lineWidth: 1.5, cursor: 'pointer' }, labelCfg: { position: 'bottom', offset: 3, style: { fill: '#333', fontSize: 9 } } },
        defaultEdge: { type: 'cubic', style: { stroke: '#91A0B0', lineWidth: 0.5, opacity: 0.25 } },
        animate: layout === 'force',
        minZoom: 0.2, maxZoom: 3,
      })
      g.data(gData)
      g.render()

      // 延迟动画：节点逐个出现（网状模式）
      if (layout === 'force') {
        setTimeout(() => g.getNodes().forEach((node: any, i: number) => {
          setTimeout(() => g.updateItem(node, { style: { fill: colorMap.get(node.getModel().id) || '#5B8FF9' }, size: DIFFICULTY_WEIGHT[(node.getModel() as any).data?.difficulty] || 20 }), i * 80)
        }), 200)
      } else {
        g.getNodes().forEach((node: any) => { const m = node.getModel() as any; if (m?.data) g.updateItem(node, { style: { fill: colorMap.get(m.data.id) || '#5B8FF9' }, size: DIFFICULTY_WEIGHT[m.data.difficulty] || 20 }) })
      }

      g.on('node:mouseenter', (e: any) => { const m = e.item?.getModel() as any; if (m?.data) g.updateItem(e.item, { style: { stroke: '#1890FF', lineWidth: 2, shadowBlur: 6 } }) })
      g.on('node:mouseleave', (e: any) => { const m = e.item?.getModel() as any; if (m?.data) g.updateItem(e.item, { style: { stroke: '#fff', lineWidth: 1.5, shadowBlur: 0 } }) })
      g.on('node:click', (e: any) => { const m = e.item?.getModel() as any; if (m?.data) { setSelectedNode(m.data); onSelect?.(selectedIds.includes(m.data.id) ? selectedIds.filter(id => id !== m.data.id) : [...selectedIds, m.data.id]) } })
      graphRef.current = g
    }

    const onResize = () => { if (graphRef.current && containerRef.current) { graphRef.current.changeSize(containerRef.current.clientWidth, height || 500); graphRef.current.fitView(20) } }
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('resize', onResize); if (graphRef.current) { graphRef.current.destroy(); graphRef.current = null } }
  }, [visibleNodes, layout, dimension, colorByDimension, height, selectedIds, onSelect, ready])

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
      {selectedNode && (<div className="absolute bottom-2 left-2 z-10 bg-white rounded-lg shadow-lg border border-gray-200 p-3 max-w-[240px] text-xs"><div className="font-semibold text-sm text-gray-900 mb-1">{selectedNode.name}</div><div className="text-gray-500 space-y-0.5"><div>{selectedNode.grade}年级·{selectedNode.semester}学期·{selectedNode.unit}</div><div>难度:<span style={{color:DIFFICULTY_COLORS[selectedNode.difficulty]}}>{selectedNode.difficulty}</span></div><div>认知:{selectedNode.cognitive}</div></div></div>)}
      {dimension !== 'knowledge' && (<div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex gap-2 text-[10px] bg-white/90 rounded-lg px-2 py-1 shadow-sm border border-gray-100">{dimension === 'difficulty' && Object.entries(DIFFICULTY_COLORS).map(([k,v]) => <span key={k} className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{background:v}}/>{k}</span>)}{dimension === 'cognitive' && Object.entries(COGNITIVE_COLORS).slice(0,4).map(([k,v]) => <span key={k} className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{background:v}}/>{k}</span>)}</div>)}
    </div>
  )
}
