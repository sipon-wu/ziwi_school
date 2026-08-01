import type { ReactNode } from 'react'
import TipTapEditor from './TipTapEditor'
import { useOpenPreview } from './EditorLayout'
import { Maximize2 } from 'lucide-react'

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
  const fullscreenBtn = onFullscreen || openPreview.openPreview !== (() => {}) ? (
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
