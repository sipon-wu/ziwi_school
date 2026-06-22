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

function buildTreeData(nodes: KnowledgeNode[]): TreeGraphData {
  const nodeMap = new Map(nodes.map(n => [n.id, { ...n }]))
  const childrenMap = new Map<string, KnowledgeNode[]>()
  const hasParent = new Set<string>()

  nodes.forEach(n => {
    if (n.parent_id) {
      hasParent.add(n.id)
      if (!childrenMap.has(n.parent_id)) childrenMap.set(n.parent_id, [])
      childrenMap.get(n.parent_id)!.push(n)
    }
  })

  function buildNode(id: string): any {
    const n = nodeMap.get(id)!
    const children = (childrenMap.get(id) || []).map(c => buildNode(c.id))
    return { id: n.id, label: n.name, children: children.length ? children : undefined, data: n }
  }

  // 找根节点：没有被 parent_id 引用的第一个节点
  const roots = nodes.filter(n => !hasParent.has(n.id) && !n.parent_id)
  if (roots.length === 0) return { id: 'root', label: '知识图谱', children: nodes.slice(0, 20).map(n => buildNode(n.id)) }

  return { id: 'root', label: '知识图谱', children: roots.slice(0, 20).map(r => buildNode(r.id)) }
}

function buildGraphData(nodes: KnowledgeNode[], filterGrade?: number, filterSubject?: string): GraphData {
  const filtered = nodes.filter(n => (!filterGrade || n.grade === filterGrade) && (!filterSubject || n.subject === filterSubject))
  const nodeMap = new Map(filtered.map(n => [n.id, n]))
  const edges: any[] = []
  filtered.forEach(n => {
    n.prerequisites?.forEach(p => { if (nodeMap.has(p)) edges.push({ source: p, target: n.id, style: { stroke: '#91D5FF', lineWidth: 1.5 } }) })
    n.next?.forEach(t => { if (nodeMap.has(t)) edges.push({ source: n.id, target: t, style: { stroke: '#B7EB8F', lineWidth: 1.5 } }) })
  })
  return {
    nodes: filtered.map(n => ({ id: n.id, label: n.name, data: n })),
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
      case 'curriculum': return node.curriculum_code ? '#722ED1' : '#1890FF'
      default: return '#1890FF'
    }
  }, [dimension])

  useEffect(() => {
    if (!containerRef.current || !graphData.nodes?.length) return
    if (graphRef.current) { graphRef.current.destroy(); graphRef.current = null }

    const container = containerRef.current
    const width = container.clientWidth
    const h = height || 500

    const graph = new G6.Graph({
      container,
      width, height: h,
      modes: {
        default: ['drag-canvas', 'zoom-canvas', 'drag-node', 'click-select'],
      },
      layout: layout === 'tree' ? { type: 'compactBox', direction: 'TB', getId: (d: any) => d.id, getHeight: () => 36, getWidth: () => 140, getVGap: () => 10, getHGap: () => 60 }
        : layout === 'circular' ? { type: 'circular', radius: Math.min(width, h) * 0.4 }
        : { type: 'force', preventOverlap: true, nodeStrength: -50, edgeStrength: 0.1 },
      defaultNode: {
        type: 'circle', size: 28,
        style: { fill: '#1890FF', stroke: '#fff', lineWidth: 2, cursor: 'pointer' },
        labelCfg: { position: 'bottom', offset: 6, style: { fill: '#333', fontSize: 11 } },
      },
      defaultEdge: { type: 'polyline', style: { stroke: '#91D5FF', lineWidth: 1.5, endArrow: { path: G6.Arrow.triangle(4, 6, 0), fill: '#91D5FF' } } },
      animate: true,
      minZoom: 0.3, maxZoom: 3,
    })

    // 构建数据
    let gData: any
    if (layout === 'tree') {
      gData = buildTreeData(data.filter(n => (graphData.nodes || []).some((gn: any) => gn.id === n.id)))
    } else {
      gData = graphData
    }

    // 按维度着色
    const colorMap = new Map<string, string>()
    data.forEach(n => colorMap.set(n.id, colorByDimension(n)))

    graph.data(gData as any)
    graph.render()

    // 自定义节点样式
    graph.getNodes().forEach((node: any) => {
      const nd = node.getModel() as any
      const ndData = nd.data || data.find(n => n.id === nd.id)
      if (ndData) {
        const color = colorMap.get(ndData.id) || '#1890FF'
        graph.updateItem(node, {
          style: { fill: color },
          label: ndData.name?.length > 6 ? ndData.name.slice(0, 6) + '...' : ndData.name,
        })
      }
    })

    // 悬停提示
    graph.on('node:mouseenter', (e: any) => {
      const nd = e.item?.getModel() as any
      const ndData = nd?.data || data.find(n => n.id === nd?.id)
      if (ndData) {
        graph.updateItem(e.item, { style: { stroke: '#1890FF', lineWidth: 3, shadowColor: '#1890FF', shadowBlur: 8 } })
      }
    })
    graph.on('node:mouseleave', (e: any) => {
      graph.updateItem(e.item, { style: { stroke: '#fff', lineWidth: 2, shadowBlur: 0 } })
    })

    // 单击选中
    graph.on('node:click', (e: any) => {
      const nd = e.item?.getModel() as any
      const ndData = nd?.data || data.find(n => n.id === nd?.id)
      if (ndData) {
        setSelectedNode(ndData)
        const newSelected = selectedIds.includes(ndData.id)
          ? selectedIds.filter(id => id !== ndData.id)
          : [...selectedIds, ndData.id]
        onSelect?.(newSelected)
      }
    })

    // 双击缩放至节点
    graph.on('node:dblclick', (e: any) => {
      const nd = e.item?.getModel() as any
      if (nd?.x && nd?.y) {
        graph.moveTo(nd.x, nd.y, true, { duration: 300 })
        graph.zoomTo(1.5, { x: nd.x, y: nd.y }, true, { duration: 300 })
      }
    })

    graphRef.current = graph

    const resizeHandler = () => {
      if (graphRef.current && containerRef.current) {
        graphRef.current.changeSize(containerRef.current.clientWidth, height || 500)
      }
    }
    window.addEventListener('resize', resizeHandler)

    return () => {
      window.removeEventListener('resize', resizeHandler)
      if (graphRef.current) { graphRef.current.destroy(); graphRef.current = null }
    }
  }, [graphData, layout, dimension, colorByDimension, height, selectedIds, onSelect, data])

  const handleFit = () => graphRef.current?.fitView(20)
  const handleReset = () => graphRef.current?.zoomTo(1, { x: 0, y: 0 })

  return (
    <div className={`relative bg-white rounded-xl border border-gray-200 overflow-hidden ${className}`}>
      {/* 工具栏 */}
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
        <div className="flex gap-1 bg-white/90 rounded-lg p-1 shadow-sm border border-gray-100">
          {(['tree', 'circular', 'force'] as LayoutMode[]).map(m => (
            <button key={m} onClick={() => setLayout(m)} className={`px-2 py-1 text-[11px] rounded transition-colors ${layout === m ? 'bg-brand text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
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

      {/* 难度过滤滑块 */}
      <div className="absolute top-2 right-2 z-10 bg-white/90 rounded-lg px-3 py-2 shadow-sm border border-gray-100 flex items-center gap-2 text-[11px]">
        <span className="text-gray-400">L1</span>
        <input type="range" min={1} max={4} value={difficultyRange[0]} onChange={e => setDifficultyRange([Number(e.target.value), Math.max(Number(e.target.value), difficultyRange[1])])} className="w-16 h-1 accent-brand" />
        <span className="text-gray-400">—</span>
        <input type="range" min={1} max={4} value={difficultyRange[1]} onChange={e => setDifficultyRange([Math.min(difficultyRange[0], Number(e.target.value)), Number(e.target.value)])} className="w-16 h-1 accent-brand" />
        <span className="text-gray-400">L4</span>
      </div>

      {/* 图谱画布 */}
      <div ref={containerRef} style={{ width: '100%', height: height || 500 }} />

      {/* 底部操作栏 */}
      <div className="absolute bottom-2 right-2 z-10 flex gap-1">
        <button onClick={handleFit} className="px-2 py-1 text-[11px] bg-white/90 rounded shadow-sm border border-gray-100 hover:bg-gray-50">适应画布</button>
        <button onClick={handleReset} className="px-2 py-1 text-[11px] bg-white/90 rounded shadow-sm border border-gray-100 hover:bg-gray-50">重置</button>
      </div>

      {/* 悬浮节点详情 */}
      {selectedNode && (
        <div className="absolute bottom-2 left-2 z-10 bg-white rounded-lg shadow-lg border border-gray-200 p-3 max-w-[240px] text-xs">
          <div className="font-semibold text-sm text-gray-900 mb-1">{selectedNode.name}</div>
          <div className="text-gray-500 space-y-0.5">
            <div>{selectedNode.grade}年级 · {selectedNode.semester}学期 · {selectedNode.unit}</div>
            <div>难度: <span style={{ color: DIFFICULTY_COLORS[selectedNode.difficulty] }}>{selectedNode.difficulty}</span></div>
            <div>认知: {selectedNode.cognitive}</div>
            {selectedNode.curriculum_code && <div>课标: {selectedNode.curriculum_code}</div>}
          </div>
        </div>
      )}

      {/* 图例 */}
      {dimension !== 'knowledge' && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex gap-2 text-[10px] bg-white/90 rounded-lg px-2 py-1 shadow-sm border border-gray-100">
          {dimension === 'difficulty' && Object.entries(DIFFICULTY_COLORS).map(([k, v]) => <span key={k} className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: v }} />{k}</span>)}
          {dimension === 'cognitive' && Object.entries(COGNITIVE_COLORS).slice(0, 4).map(([k, v]) => <span key={k} className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: v }} />{k}</span>)}
        </div>
      )}
    </div>
  )
}
