import { useState, useCallback, useRef } from 'react'
import { X, Search, Maximize, Trash2, GripHorizontal } from 'lucide-react'
import KnowledgeGraph from './KnowledgeGraph'
import { useTeaching } from '@/lib/TeachingContext'
import { useIsMobile } from '@/hooks/useMediaQuery'
import type { KnowledgeNode } from './KnowledgeGraph'
import type { UseKnowledgePickerReturn } from '@/hooks/useKnowledgePicker'

interface Props {
  /** 知识图谱状态（来自 useKnowledgePicker hook） */
  picker: UseKnowledgePickerReturn
  /** 关闭面板（清除选中并隐藏） */
  onClose: () => void
}

// ── 共享子组件：已选 chip 列表 ──
function SelectedChips({
  nodes,
  onRemove,
  onClear,
}: {
  nodes: KnowledgeNode[]
  onRemove: (id: string) => void
  onClear: () => void
}) {
  if (nodes.length === 0) return null
  return (
    <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/50 shrink-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] text-gray-500">已选 {nodes.length} 个知识点</span>
        <button onClick={onClear} className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-red-500">
          <Trash2 size={10} />清空
        </button>
      </div>
      <div className="flex flex-wrap gap-1 max-h-[80px] overflow-y-auto">
        {nodes.map(node => (
          <span
            key={node.id}
            className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[11px] bg-brand/10 text-brand rounded-full cursor-pointer hover:bg-brand/20"
            title={node.name}
          >
            {node.name}
            <button onClick={() => onRemove(node.id)} className="text-brand/50 hover:text-brand">&times;</button>
          </span>
        ))}
      </div>
    </div>
  )
}

// ── 共享子组件：搜索栏 ──
function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="px-3 py-2 border-b border-gray-100 shrink-0">
      <div className="relative">
        <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-300" />
        <input
          type="text"
          placeholder="搜索知识点..."
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full pl-6 pr-2 py-1 text-[11px] border border-gray-200 rounded focus:outline-none focus:border-brand"
        />
      </div>
    </div>
  )
}

// ── 共享子组件：图谱可视化 ──
function GraphView({
  picker,
  teaching,
  handleSelect,
  height,
  width,
}: {
  picker: UseKnowledgePickerReturn
  teaching: any
  handleSelect: (ids: string[]) => void
  height?: number
  width?: number
}) {
  return (
    <KnowledgeGraph
      data={picker.knowledgeData}
      subject={teaching.subject}
      grade={teaching.grade}
      semester={teaching.semester}
      textbook={teaching.textbook_math}
      selectedIds={picker.selectedIds}
      onSelect={handleSelect}
      inline
      height={height || 420}
      width={width}
      layoutMode={picker.graphLayout as any}
      onLayoutChange={picker.setGraphLayout as any}
      colorDimension={picker.graphDimension as any}
      onDimensionChange={picker.setGraphDimension as any}
      diffRange={picker.diffRange}
      onDiffRangeChange={picker.setDiffRange as any}
    />
  )
}

/**
 * KnowledgePanel — 知识图谱工具面板
 *
 * 桌面端（>=lg）：右侧固定 320px 面板
 * 移动端（<lg）：底部抽屉 60vh 从底部滑出
 */
export default function KnowledgePanel({ picker, onClose }: Props) {
  const teaching = useTeaching()
  const isMobile = useIsMobile()
  const {
    setSelectedIds, selectedNodes,
    currentUnits, selectedUnit, handleUnitChange,
  } = picker

  const [searchTerm, setSearchTerm] = useState('')
  const [showFullscreen, setShowFullscreen] = useState(false)
  const [drawerHeight, setDrawerHeight] = useState(60)
  const dragStartRef = useRef<{ y: number; h: number } | null>(null)

  // 桌面端面板宽度（拖拽调整，persist 到 localStorage）
  const [panelWidth, setPanelWidth] = useState(() => {
    const saved = localStorage.getItem('kg_panel_width')
    return saved ? Math.max(280, Math.min(560, Number(saved))) : 320
  })
  const resizeRef = useRef<{ x: number; w: number } | null>(null)

  // 左边缘水平拖拽调整宽度
  const handleResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX
    resizeRef.current = { x, w: panelWidth }

    const handleMove = (ev: MouseEvent | TouchEvent) => {
      if (!resizeRef.current) return
      const moveX = 'touches' in ev ? ev.touches[0].clientX : ev.clientX
      const deltaX = resizeRef.current.x - moveX // 向左拖 = 变宽（deltaX > 0）
      const newWidth = Math.min(560, Math.max(280, resizeRef.current.w + deltaX))
      setPanelWidth(newWidth)
    }

    const handleUp = () => {
      if (resizeRef.current) {
        localStorage.setItem('kg_panel_width', String(panelWidth))
      }
      resizeRef.current = null
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)
      document.removeEventListener('touchmove', handleMove)
      document.removeEventListener('touchend', handleUp)
    }

    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
    document.addEventListener('touchmove', handleMove)
    document.addEventListener('touchend', handleUp)
  }, [panelWidth])

  // 选中处理
  const handleSelect = useCallback((ids: string[]) => {
    setSelectedIds(ids)
  }, [setSelectedIds])

  const removeSelected = useCallback((id: string) => {
    setSelectedIds(prev => prev.filter(i => i !== id))
  }, [setSelectedIds])

  const clearAll = useCallback(() => {
    setSelectedIds([])
  }, [setSelectedIds])

  // 拖拽调整抽屉高度（移动端）
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const y = 'touches' in e ? e.touches[0].clientY : e.clientY
    dragStartRef.current = { y, h: drawerHeight }

    const handleMove = (ev: MouseEvent | TouchEvent) => {
      if (!dragStartRef.current) return
      const moveY = 'touches' in ev ? ev.touches[0].clientY : ev.clientY
      const deltaY = dragStartRef.current.y - moveY
      const viewportH = window.innerHeight
      const deltaPercent = (deltaY / viewportH) * 100
      const newHeight = Math.min(85, Math.max(30, dragStartRef.current.h + deltaPercent))
      setDrawerHeight(newHeight)
    }

    const handleUp = () => {
      dragStartRef.current = null
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)
      document.removeEventListener('touchmove', handleMove)
      document.removeEventListener('touchend', handleUp)
    }

    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
    document.addEventListener('touchmove', handleMove)
    document.addEventListener('touchend', handleUp)
  }, [drawerHeight])

  // 全屏弹窗（含已选列表 + 搜索 + 单元选择 + 动态高度）
  const fullscreenHeight = Math.floor(Math.min(window.innerHeight * 0.9, 960))
  const FullscreenGraph = showFullscreen ? (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center" onClick={() => setShowFullscreen(false)}>
      <div className="w-full h-full max-w-[1400px] max-h-[95vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-gray-100 bg-gray-50 shrink-0">
          <span className="text-sm font-semibold text-gray-800">知识点图谱 · 全屏</span>
          <button onClick={() => setShowFullscreen(false)} className="p-1.5 hover:bg-gray-200 rounded-lg"><X size={16} /></button>
        </div>

        {/* 已选知识点 + 搜索 + 单元选择 */}
        <div className="px-4 py-2 border-b border-gray-100 bg-white shrink-0 space-y-2">
          {/* 已选 chip 列表 */}
          {selectedNodes.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-400 shrink-0">已选 {selectedNodes.length}</span>
              <div className="flex flex-wrap gap-1 flex-1">
                {selectedNodes.map(node => (
                  <span key={node.id} className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[11px] bg-brand/10 text-brand rounded-full">
                    {node.name}
                    <button onClick={() => removeSelected(node.id)} className="text-brand/50 hover:text-brand">&times;</button>
                  </span>
                ))}
              </div>
              <button onClick={clearAll} className="text-[10px] text-gray-400 hover:text-red-500 shrink-0 flex items-center gap-0.5">
                <Trash2 size={10} />清空
              </button>
            </div>
          )}
          {/* 搜索 + 单元选择（同一行） */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                type="text"
                placeholder="搜索知识点..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-6 pr-2 py-1 text-[11px] border border-gray-200 rounded focus:outline-none focus:border-brand"
              />
            </div>
            {currentUnits.length > 0 && (
              <select
                value={selectedUnit}
                onChange={e => handleUnitChange(e.target.value)}
                className="text-[11px] border border-gray-200 rounded px-2 py-1 outline-none focus:border-brand w-36 shrink-0"
              >
                {currentUnits.map((u: any) => (
                  <option key={u.unit} value={u.unit}>{u.unit}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* 图谱画布 */}
        <div className="flex-1 relative">
          <GraphView picker={picker} teaching={teaching} handleSelect={handleSelect} height={fullscreenHeight} />
        </div>
      </div>
    </div>
  ) : null

  // ── 移动端：底部抽屉模式 ──
  if (isMobile) {
    return (
      <>
        {/* 遮罩 */}
        <div
          className="fixed inset-0 bg-black/40 z-40"
          onClick={onClose}
        />

        {/* 底部抽屉 */}
        <div
          className="fixed bottom-0 left-0 right-0 bg-white z-50 flex flex-col rounded-t-2xl shadow-2xl safe-bottom transition-all duration-300"
          style={{ height: `${drawerHeight}vh` }}
        >
          {/* 拖拽手柄 */}
          <div
            className="flex-shrink-0 flex flex-col items-center pt-2 pb-1 cursor-grab active:cursor-grabbing"
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
          >
            <GripHorizontal size={20} className="text-gray-300" />
            <span className="text-[10px] text-gray-400 mt-0.5 select-none">拖拽调整高度</span>
          </div>

          {/* 标题栏 */}
          <div className="flex items-center justify-between px-4 py-1.5 border-b border-gray-100 shrink-0">
            <span className="text-[13px] font-semibold text-gray-700">知识图谱</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowFullscreen(true)}
                className="p-1.5 text-gray-400 hover:text-brand active:bg-brand/5 rounded-lg"
                title="全屏展开"
              >
                <Maximize size={15} />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 text-gray-400 hover:text-red-500 active:bg-red-50 rounded-lg"
                title="关闭"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* 已选知识点 chip */}
          <SelectedChips nodes={selectedNodes} onRemove={removeSelected} onClear={clearAll} />

          {/* 单元快速选 */}
          {currentUnits.length > 0 && (
            <div className="px-3 py-1.5 border-b border-gray-100 shrink-0">
              <select
                value={selectedUnit}
                onChange={e => handleUnitChange(e.target.value)}
                className="w-full text-[12px] border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-brand"
              >
                {currentUnits.map((u: any) => (
                  <option key={u.unit} value={u.unit}>{u.unit}</option>
                ))}
              </select>
            </div>
          )}

          {/* 搜索 */}
          <SearchBar value={searchTerm} onChange={setSearchTerm} />

          {/* 图谱可视化 */}
          <div className="flex-1 min-h-0 bg-gray-50/50 relative">
            <GraphView picker={picker} teaching={teaching} handleSelect={handleSelect} />
          </div>
        </div>

        {FullscreenGraph}
      </>
    )
  }

  // ── 桌面端：右侧面板 ──
  return (
    <>
      <aside
        className="hidden lg:flex flex-col bg-white border-l border-gray-200 shrink-0 overflow-hidden relative"
        style={{ width: panelWidth }}
      >
        {/* 左边缘拖拽手柄 */}
        <div
          className="absolute left-0 top-0 bottom-0 w-[6px] -ml-[3px] z-10 cursor-col-resize group"
          onMouseDown={handleResizeStart}
          onTouchStart={handleResizeStart}
        >
          <div className="w-[2px] h-full mx-auto bg-transparent group-hover:bg-brand/30 group-active:bg-brand transition-colors" />
        </div>

        {/* 标题栏 */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50 shrink-0">
          <span className="text-[13px] font-semibold text-gray-700">知识图谱</span>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-300 mr-1">{panelWidth}px</span>
            <button
              onClick={() => setShowFullscreen(true)}
              className="p-1 text-gray-400 hover:text-brand hover:bg-brand/5 rounded"
              title="全屏展开"
            >
              <Maximize size={14} />
            </button>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
              title="关闭图谱面板"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* 已选知识点 chip 列表 */}
        <SelectedChips nodes={selectedNodes} onRemove={removeSelected} onClear={clearAll} />

        {/* 单元快速选 */}
        {currentUnits.length > 0 && (
          <div className="px-3 py-2 border-b border-gray-100 shrink-0">
            <select
              value={selectedUnit}
              onChange={e => handleUnitChange(e.target.value)}
              className="w-full text-[11px] border border-gray-200 rounded px-2 py-1 outline-none focus:border-brand"
            >
              {currentUnits.map((u: any) => (
                <option key={u.unit} value={u.unit}>{u.unit}</option>
              ))}
            </select>
          </div>
        )}

        {/* 搜索 */}
        <SearchBar value={searchTerm} onChange={setSearchTerm} />

        {/* 图谱可视化区域 */}
        <div className="flex-1 relative min-h-0 bg-gray-50/50">
          <GraphView picker={picker} teaching={teaching} handleSelect={handleSelect} width={panelWidth} />
        </div>
      </aside>

      {/* 全屏模式 */}
      {FullscreenGraph}
    </>
  )
}
