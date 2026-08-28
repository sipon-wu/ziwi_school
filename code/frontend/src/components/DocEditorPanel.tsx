/* eslint-disable react/only-export-components */
import type { ReactNode } from 'react'
import { Minimize2 } from 'lucide-react'
import TipTapEditor from './TipTapEditor'
import { useOpenPreview } from './EditorLayout'
import { Maximize2 } from 'lucide-react'

/**
 * 共享「编辑态全屏」覆盖层：与 P0 预览全屏（只读）并列的另一条全屏路径。
 * 顶栏深色（主题一致：提示文案 + 退出全屏 + 完成），主体复用 TipTapEditor（fullscreen=true，
 * 自动铺满视口并带批注/章节导航右栏）。所有文档模式编辑器共用，保证全屏与非全屏工具栏一致。
 */
export function renderFullscreenEditor(opts: {
  value: string
  onChange: (html: string) => void
  docTitle: string
  readOnly?: boolean
  toolbarExtra?: ReactNode
  onExit: () => void
}): ReactNode {
  const { value, onChange, docTitle, readOnly, toolbarExtra, onExit } = opts
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#1F2937]">
      <div className="h-11 shrink-0 flex items-center gap-3 px-4 bg-[#1F2937] text-white">
        <span className="text-[13px] font-medium">文档模式 · 全屏编辑（A4 纸面）</span>
        <span className="ml-4 text-[11px] text-white/50">{docTitle}</span>
        <div className="ml-auto flex items-center gap-2">
          {toolbarExtra}
          <button onClick={onExit}
            className="flex items-center gap-1 px-3 py-1 text-[12px] bg-white/10 hover:bg-white/20 rounded transition-colors"
          >
            <Minimize2 size={12} /> 退出全屏
          </button>
          <button onClick={onExit}
            className="px-3 py-1 text-[12px] bg-[#02A7F0] hover:bg-[#0288D1] rounded"
          >
            完成
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <TipTapEditor
          value={value}
          onChange={onChange}
          fullscreen
          docTitle={docTitle}
          readOnly={readOnly}
          toolbarExtra={toolbarExtra}
        />
      </div>
    </div>
  )
}

interface DocEditorPanelProps {
  /** 顶栏提示文案（可含题量 / 分数等统计），框架统一为灰底一行 */
  hint?: ReactNode
  value: string
  onChange: (html: string) => void
  docTitle?: string
  readOnly?: boolean
  placeholder?: string
  /** 工具栏尾部注入（如 导出 / 全屏），与教案框架一致，与内置"导入 Word / 保存版本"并列 */
  toolbarExtra?: ReactNode
  /** 覆盖默认的全屏预览行为（如教案走全屏编辑）；不传则走 EditorLayout PreviewOverlay 全屏预览 */
  onFullscreen?: () => void
  /** 批注/版本入库：作品资源类型 + id（透传给 TipTapEditor） */
  resourceType?: string
  resourceId?: string
  /** 作品已发布 → 版本只读禁存/禁恢复 */
  locked?: boolean
}

/**
 * 文档模式编辑区统一框架外壳（P0 统一框架）。
 * 所有编辑器（教案 / 习题 / 试卷 / 题单）的文档模式右栏共用，消除各页手写导致的"另一套框架"。
 */
export default function DocEditorPanel({ hint, value, onChange, docTitle, readOnly, placeholder, toolbarExtra, onFullscreen, resourceType, resourceId, locked }: DocEditorPanelProps) {
  const openPreview = useOpenPreview()
  const fullscreenBtn = onFullscreen || openPreview.openPreview ? (
    <button onClick={onFullscreen || openPreview.openPreview}
      className="flex items-center gap-1 px-2 h-7 text-[11px] rounded text-[#02A7F0] border border-[#02A7F0] hover:bg-[#E8F7FF] transition-colors"
      title="全屏预览">
      <Maximize2 size={11} /> 全屏
    </button>
  ) : null
  const mergedToolbarExtra = (
    <>
      {toolbarExtra}
      {fullscreenBtn}
    </>
  )
  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-[#F0F0F0] shrink-0 bg-[#FAFBFC]">
        {hint != null ? <span className="text-[12px] text-[#9A9A9A]">{hint}</span> : null}
      </div>
      <div className="flex-1 overflow-hidden">
        <TipTapEditor
          value={value}
          onChange={onChange}
          docTitle={docTitle}
          readOnly={readOnly}
          placeholder={placeholder}
          toolbarExtra={mergedToolbarExtra}
          resourceType={resourceType}
          resourceId={resourceId}
          locked={locked}
        />
      </div>
    </div>
  )
}
