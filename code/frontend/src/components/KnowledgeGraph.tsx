import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import G6, { type Graph, type GraphData, type TreeGraphData } from '@antv/g6'

export interface KnowledgeNode {
  id: string; name: string; subject: string; grade: number; semester: string
  unit: string; difficulty: string; cognitive: string; curriculum_code: string
  parent_id: string | null; prerequisites: string[]; next: string[]
}

type LayoutMode = 'tree' | 'circular' | 'force'
type Dimension = 'knowledge' | 'cognitive' | 'difficulty' | 'curriculum'

interface Props {
  data: KnowledgeNode[]
  grade?: number
  subject?: string
  selectedIds?: string[]
  onSelect?: (ids: string[]) => void
  className?: string
  height?: number
}

const DIFFICULTY_COLORS: Record<string, string> = { L1: '#52C41A', L2: '#1890FF', L3: '#FA8C16', L4: '#F5222D' }
const COGNITIVE_COLORS: Record<string, string> = { '记忆': '#B37FEB', '理解': '#5CDBD3', '应用': '#1890FF', '分析': '#FA8C16', '评价': '#F5222D', '创造': '#EB2F96' }

/** 按 年级→学期→单元→知识点 构建四层树 */
function buildTreeData(nodes: KnowledgeNode[]): TreeGraphData {
  if (nodes.length === 0) return { id: 'root', label: '暂无数据', children: [] }

  // 按年级分组
  const byGrade = new Map<number, KnowledgeNode[]>()
  nodes.forEach(n => { const g = n.grade || 1; if (!byGrade.has(g)) byGrade.set(g, []); byGrade.get(g)!.push(n) })

  // 年级排序
  const sortedGrades = Array.from(byGrade.keys()).sort((a, b) => a - b)
  if (sortedGrades.length === 0) return { id: 'root', label: '知识图谱', children: [] }

  const gradeChildren = sortedGrades.map(g => {
    const gradeNodes = byGrade.get(g)!
    // 按学期分组
    const bySemester = new Map<string, KnowledgeNode[]>()
    gradeNodes.forEach(n => { const s = n.semester || '上'; if (!bySemester.has(s)) bySemester.set(s, []); bySemester.get(s)!.push(n) })

    const semesterChildren = Array.from(bySemester.keys()).map(s => {
      const semNodes = bySemester.get(s)!
      // 按单元分组
      const byUnit = new Map<string, KnowledgeNode[]>()
      semNodes.forEach(n => { const u = n.unit || '其他'; if (!byUnit.has(u)) byUnit.set(u, []); byUnit.get(u)!.push(n) })

      const unitChildren = Array.from(byUnit.keys()).map(u => {
        const kpNodes = byUnit.get(u)!
        return {
          id: `unit-${u}`,
          label: u.length > 12 ? u.slice(0, 12) + '...' : u,
          children: kpNodes.map(k => ({ id: k.id, label: k.name.length > 8 ? k.name.slice(0, 8) + '...' : k.name, data: k })),
          style: { fill: '#5B8FF9', stroke: '#5B8FF9' },
          type: 'rect' as const,
          size: [120, 24],
          labelCfg: { position: 'center' as const, style: { fill: '#fff', fontSize: 10 } },
        }
      })
      return { id: `sem-${g}-${s}`, label: `${g}年级${s}学期`, children: unitChildren, style: { fill: '#F6BD16', stroke: '#F6BD16' }, type: 'rect', size: [120, 26], labelCfg: { position: 'center' as const, style: { fill: '#fff', fontSize: 11, fontWeight: 700 } } }
    })
    return { id: `grade-${g}`, label: `${g}年级`, children: semesterChildren, style: { fill: '#FF9845', stroke: '#FF9845' }, type: 'rect', size: [100, 28], labelCfg: { position: 'center' as const, style: { fill: '#fff', fontSize: 12, fontWeight: 700 } } }
  })

  return { id: 'root', label: `${nodes[0]?.subject || ''}知识体系`, children: gradeChildren }
}

function buildGraphData(nodes: KnowledgeNode[], filterGrade?: number, filterSubject?: string): GraphData {
  const filtered = nodes.filter(n => (!filterGrade || n.grade === filterGrade) && (!filterSubject || n.subject === filterSubject))
  const nodeMap = new Map(filtered.map(n => [n.id, n]))
  const edges: any[] = []
  filtered.forEach(n => {
    n.prerequisites?.forEach(p => { if (nodeMap.has(p)) edges.push({ source: p, target: n.id, style: { stroke: '#5B8FF9', lineWidth: 1.5 } }) })
    n.next?.forEach(t => { if (nodeMap.has(t)) edges.push({ source: n.id, target: t, style: { stroke: '#52C41A', lineWidth: 1.5, lineDash: [4, 2] } }) })
  })
  return {
    nodes: filtered.map(n => ({ id: n.id, label: n.name.length > 6 ? n.name.slice(0, 6) + '...' : n.name, data: n })),
    edges,
  }
}

export default function KnowledgeGraph({ data, grade = 4, subject = '数学', selectedIds = [], onSelect, className = '', height = 500 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const graphRef = useRef<Graph | null>(null)
  const [layout, setLayout] = useState<LayoutMode>('tree')
  const [dimension, setDimension] = useState<Dimension>('knowledge')
  const [difficultyRange, setDifficultyRange] = useState<[number, number]>([1, 4])
  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null)

  const graphData = useMemo(() => {
    const filtered = data.filter(n => {
      const d = parseInt(n.difficulty.replace('L', ''))
      return d >= difficultyRange[0] && d <= difficultyRange[1]
    })
    return buildGraphData(filtered, grade, subject)
  }, [data, grade, subject, difficultyRange])

  const colorByDimension = useCallback((node: KnowledgeNode): string => {
    switch (dimension) {
      case 'difficulty': return DIFFICULTY_COLORS[node.difficulty] || '#1890FF'
      case 'cognitive': return COGNITIVE_COLORS[node.cognitive] || '#1890FF'
      case 'curriculum': return '#722ED1'
      default: return '#5B8FF9'
    }
  }, [dimension])

  useEffect(() => {
    const nodes = data.filter(n => n.subject === subject)
    if (!containerRef.current || nodes.length === 0) return
    if (graphRef.current) { graphRef.current.destroy(); graphRef.current = null }

    const container = containerRef.current
    const w = container.clientWidth || 800
    const h = height || 500

    const graph = new G6.Graph({
      container,
      width: w, height: h,
      fitView: true,
      fitViewPadding: [20, 40, 20, 40],
      modes: { default: ['drag-canvas', 'zoom-canvas', 'drag-node', 'click-select'] },
      layout: layout === 'tree'
        ? { type: 'compactBox', direction: 'LR', getId: (d: any) => d.id, getHeight: () => 30, getWidth: (d: any) => d.size?.[0] || 100, getVGap: () => 6, getHGap: () => 40 }
        : layout === 'circular'
          ? { type: 'circular', radius: Math.min(w, h) * 0.38, divisions: 5, ordering: 'topology' }
          : { type: 'force', preventOverlap: true, nodeStrength: -120, edgeStrength: 0.05, nodeSpacing: 60 },
      defaultNode: {
        size: 26,
        style: { fill: '#5B8FF9', stroke: '#fff', lineWidth: 2, cursor: 'pointer' },
        labelCfg: { position: 'bottom', offset: 5, style: { fill: '#333', fontSize: 10 } },
      },
      // 曲线连线
      defaultEdge: {
        type: layout === 'tree' ? 'cubic-vertical' : 'cubic',
        style: { stroke: '#A0A0A0', lineWidth: 1.2, endArrow: { path: G6.Arrow.triangle(3, 5, 0), fill: '#A0A0A0' } },
      },
      animate: true,
      minZoom: 0.2, maxZoom: 3,
    })

    // 树状：用层级数据；其他：用平铺图数据
    const gData = layout === 'tree' ? buildTreeData(nodes) : graphData

    // 颜色映射
    const colorMap = new Map<string, string>()
    nodes.forEach(n => colorMap.set(n.id, colorByDimension(n)))

    graph.data(gData as any)
    graph.render()

    // 自定义叶子节点颜色
    if (layout === 'tree') {
      graph.getNodes().forEach((node: any) => {
        const model = node.getModel() as any
        if (model.data) {
          const c = colorMap.get(model.data.id) || '#5B8FF9'
          graph.updateItem(node, { style: { fill: c }, label: model.data.name?.length > 8 ? model.data.name.slice(0, 8) + '...' : model.data.name })
        }
      })
    } else {
      graph.getNodes().forEach((node: any) => {
        const model = node.getModel() as any
        if (model.data) {
          const c = colorMap.get(model.data.id) || '#5B8FF9'
          graph.updateItem(node, { style: { fill: c }, label: model.data.name?.length > 6 ? model.data.name.slice(0, 6) + '...' : model.data.name })
        }
      })
    }

    graph.on('node:mouseenter', (e: any) => {
      const m = e.item?.getModel() as any
      if (m?.data) {
        graph.updateItem(e.item, { style: { stroke: '#1890FF', lineWidth: 3, shadowColor: '#1890FF', shadowBlur: 8 } })
      }
    })
    graph.on('node:mouseleave', (e: any) => {
      const m = e.item?.getModel() as any
      if (m?.data) graph.updateItem(e.item, { style: { stroke: '#fff', lineWidth: 2, shadowBlur: 0 } })
    })
    graph.on('node:click', (e: any) => {
      const m = e.item?.getModel() as any
      if (m?.data) {
        setSelectedNode(m.data)
        const ns = selectedIds.includes(m.data.id) ? selectedIds.filter(id => id !== m.data.id) : [...selectedIds, m.data.id]
        onSelect?.(ns)
      }
    })

    graphRef.current = graph

    const onResize = () => {
      if (graphRef.current && containerRef.current) {
        graphRef.current.changeSize(containerRef.current.clientWidth, height || 500)
        graphRef.current.fitView(20)
      }
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      if (graphRef.current) { graphRef.current.destroy(); graphRef.current = null }
    }
  }, [graphData, layout, dimension, colorByDimension, height, selectedIds, onSelect, data, subject])

  const handleFit = () => graphRef.current?.fitView(20)
  const handleReset = () => graphRef.current?.zoomTo(1, { x: 0, y: 0 })

  return (
    <div className={`relative bg-white rounded-xl border border-gray-200 overflow-hidden ${className}`}>
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
        <div className="flex gap-1 bg-white/90 rounded-lg p-1 shadow-sm border border-gray-100">
          {(['tree', 'circular', 'force'] as LayoutMode[]).map(m => (
            <button key={m} onClick={() => { setDimension('knowledge'); setLayout(m) }} className={`px-2 py-1 text-[11px] rounded transition-colors ${layout === m ? 'bg-brand text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
              {m === 'tree' ? '树状' : m === 'circular' ? '环状' : '网状'}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-white/90 rounded-lg p-1 shadow-sm border border-gray-100">
          {(['knowledge', 'cognitive', 'difficulty', 'curriculum'] as Dimension[]).map(d => (
            <button key={d} onClick={() => setDimension(d)} className={`px-2 py-1 text-[11px] rounded transition-colors ${dimension === d ? 'bg-brand text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
              {d === 'knowledge' ? '知识点' : d === 'cognitive' ? '能力' : d === 'difficulty' ? '难度' : '课标'}
            </button>
          ))}
        </div>
      </div>

      <div className="absolute top-2 right-2 z-10 bg-white/90 rounded-lg px-3 py-2 shadow-sm border border-gray-100 flex items-center gap-2 text-[11px]">
        <span className="text-gray-400">L1</span>
        <input type="range" min={1} max={4} value={difficultyRange[0]} onChange={e => setDifficultyRange([Number(e.target.value), Math.max(Number(e.target.value), difficultyRange[1])])} className="w-12 h-1 accent-brand" />
        <span className="text-gray-400">—</span>
        <input type="range" min={1} max={4} value={difficultyRange[1]} onChange={e => setDifficultyRange([Math.min(difficultyRange[0], Number(e.target.value)), Number(e.target.value)])} className="w-12 h-1 accent-brand" />
        <span className="text-gray-400">L4</span>
      </div>

      <div ref={containerRef} style={{ width: '100%', height: height || 500 }} />

      <div className="absolute bottom-2 right-2 z-10 flex gap-1">
        <button onClick={handleFit} className="px-2 py-1 text-[11px] bg-white/90 rounded shadow-sm border border-gray-100 hover:bg-gray-50">适应画布</button>
        <button onClick={handleReset} className="px-2 py-1 text-[11px] bg-white/90 rounded shadow-sm border border-gray-100 hover:bg-gray-50">重置</button>
      </div>

      {selectedNode && (
        <div className="absolute bottom-2 left-2 z-10 bg-white rounded-lg shadow-lg border border-gray-200 p-3 max-w-[240px] text-xs">
          <div className="font-semibold text-sm text-gray-900 mb-1">{selectedNode.name}</div>
          <div className="text-gray-500 space-y-0.5">
            <div>{selectedNode.grade}年级·{selectedNode.semester}学期·{selectedNode.unit}</div>
            <div>难度:<span style={{color:DIFFICULTY_COLORS[selectedNode.difficulty]}}>{selectedNode.difficulty}</span></div>
            <div>认知:{selectedNode.cognitive}</div>
            {selectedNode.curriculum_code&&<div>课标:{selectedNode.curriculum_code}</div>}
          </div>
        </div>
      )}

      {dimension !== 'knowledge' && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex gap-2 text-[10px] bg-white/90 rounded-lg px-2 py-1 shadow-sm border border-gray-100">
          {dimension === 'difficulty' && Object.entries(DIFFICULTY_COLORS).map(([k,v]) => <span key={k} className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{background:v}}/>{k}</span>)}
          {dimension === 'cognitive' && Object.entries(COGNITIVE_COLORS).slice(0,4).map(([k,v]) => <span key={k} className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{background:v}}/>{k}</span>)}
        </div>
      )}
    </div>
  )
}
