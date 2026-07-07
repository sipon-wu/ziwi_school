/**
 * KnowledgeGraphTool — 独立知识图谱工具组件
 *
 * 输入：data（全量节点）+ filter（过滤参数）+ selectedIds（受控）
 * 输出：onSelect(ids)（选中变更回调）
 *
 * 内部封装：搜索框 / 布局模式切换 / 着色维度切换 / 难度范围滑块
 * 使用方：LessonPlanEditor / ExerciseGenerator / 组卷页面等，统一调用方式
 */
import { useState, Suspense, lazy } from 'react'
import { Search } from 'lucide-react'
import { filterKnowledgeNodes, searchNodes } from './filter'
import type { KnowledgeGraphToolProps, LayoutMode, ColorDimension } from './types'

const KnowledgeGraph = lazy(() => import('../KnowledgeGraph'))

export type { KnowledgeNode, LayoutMode, ColorDimension, FilterParams } from './types'

export default function KnowledgeGraphTool({
  data,
  filter,
  selectedIds,
  onSelect,
}: KnowledgeGraphToolProps) {
  // ── 内部控制状态 ──
  const [searchText, setSearchText] = useState('')
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('tree')
  const [colorDimension, setColorDimension] = useState<ColorDimension>('knowledge')
  const [diffRange, setDiffRange] = useState<[number, number]>(filter.difficultyRange || [1, 4])

  // ── 同步外部 diffRange ──
  const effectiveDiffRange: [number, number] = filter.difficultyRange || diffRange

  return (
    <div className="flex-1 bg-white overflow-hidden flex flex-col">
      {/* Header — 搜索框 */}
      <div className="h-10 flex items-center justify-between px-4 border-b border-[#F0F0F0] shrink-0">
        <span className="text-[13px] font-medium text-[#353535]">知识图谱</span>
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
          <input
            type="text"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="搜索知识点"
            className="pl-6 pr-2 py-1 text-[11px] border border-[#E7E7EB] rounded-[4px] focus:outline-none focus:border-[#02A7F0] w-40"
          />
        </div>
      </div>

      {/* Graph Area */}
      <div className="flex-1 relative pb-[45px]">
        <Suspense fallback={
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-4 border-[#02A7F0]/20 border-t-[#02A7F0] rounded-full animate-spin" />
          </div>
        }>
          <KnowledgeGraph
            data={searchText ? searchNodes(data, searchText) : data}
            subject={filter.subject}
            grade={filter.grade}
            semester={filter.semester}
            selectedIds={selectedIds}
            onSelect={onSelect}
            inline
            layoutMode={layoutMode}
            onLayoutChange={setLayoutMode}
            colorDimension={colorDimension}
            onDimensionChange={setColorDimension}
            diffRange={effectiveDiffRange}
            onDiffRangeChange={setDiffRange}
          />
        </Suspense>
      </div>
    </div>
  )
}
