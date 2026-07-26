import { type ReactNode, useState, createContext, useContext, useMemo } from 'react'
import HeaderRight from './HeaderRight'
import LogoText from './LogoText'
import PreviewOverlay from './PreviewOverlay'
import type { EditorStatus } from '../hooks/useEditorLifecycle'

interface PreviewCtxValue { openPreview: () => void }
const PreviewCtx = createContext<PreviewCtxValue>({ openPreview: () => {} })
export const useOpenPreview = () => useContext(PreviewCtx)

/**
 * EditorLayout — P0 编辑器框架布局骨架
 * 职责边界：只管布局骨架（左栏 / 右栏 / footer / 全屏预览 overlay / 模式切换）。
 * 不持有任何版面 / 版心尺寸——版面版心是【场景层】属性，由场景组件各自持有：
 *   文档场景（教案/出题/题单）= A4，在 TipTapEditor 的 DOC_PAGE 常量
 *   试卷场景（组卷）= A4单列/A3双列/A3三列，在 ExamPreview
 *   幻灯片场景（PPT）= 4:3 / 16:9，在 PPT 提纲编辑器
 * 框架层不接收、不计算、不约束任何版心像素值。
 *
 * 框架一致性铁律（对标 XMIND「框架」标签，四场景必须完全一致）：
 *   - 模式切换标签固定为 ['AI 模式', '文档模式']，框架内置，页面不可覆盖（防漂移）。
 *   - 左栏固定宽 466px，不可收起（去除 collapse，四场景完全一致）。
 *   - 顶栏 = logo(场景名) + 模式切换 + headerRight，四场景完全一致。
 */
interface Props {
  /**
   * 当前模式：'primary'=左标签激活，'secondary'=右标签激活。
   * 决定渲染 primaryLeft/primaryRight 还是 secondaryLeft/secondaryRight。
   */
  mode: 'primary' | 'secondary'
  /** 模式切换回调（调用方可在此做业务检查再切换） */
  onModeChange?: (mode: 'primary' | 'secondary') => void
  /** 锁定模式切换（只显示当前标签文字，按钮变灰） */
  modeLocked?: boolean
  /** 锁定模式下显示的文字（如"预览模式 · 只读"） */
  modeLockedLabel?: string
  /** 自定义模式标签（默认 ['AI 模式', '文档模式']） */
  modeLabels?: [string, string]

  /** 主模式（左标签）左栏内容 */
  primaryLeft?: ReactNode
  /** 主模式（左标签）右栏内容 */
  primaryRight?: ReactNode
  /** 辅模式（右标签）左栏内容 */
  secondaryLeft?: ReactNode
  /** 辅模式（右标签）右栏内容 */
  secondaryRight?: ReactNode

  /** 场景名（如"教案/习题/试卷/题单"），显示在 Header logo 位："知微教学 - 工作台 · 教案" */
  sceneName?: string

  // ========== 统一底边栏 ==========
  /** 底边栏上方区域（如 小微入口条），框架不做额外包裹 */
  footerExtra?: ReactNode
  /** 底边栏左侧按钮（如 保存为草稿），框架居中放置 */
  footerLeft?: ReactNode
  /** 底边栏右侧按钮（如 发布/保存），框架居中放置 */
  footerRight?: ReactNode
  /** 隐藏框架内置"预览/返回编辑"按钮（默认 false）；仅在极简页面（如加载态）传入 true */
  hidePreviewBtn?: boolean
  /** 页面自定义预览回调（旧行为 fallback）。不传 previewSlot 时生效：默认切到 secondary 模式 */
  onPreview?: () => void
  /**
   * 受控预览：传入即用「页面持有 open 状态」模式（查看态自动开全屏预览 / 进入编辑态需先关）。
   * 不传则框架内部自管理（编辑态内点「预览」开 overlay 的默认行为）。
   */
  previewOpen?: boolean
  onPreviewChange?: (open: boolean) => void
  /** 预览 overlay 内「编辑」按钮的点击处理（如直接进入编辑态）。不传则用 onPreviewChange(false) */
  onPreviewEdit?: () => void

  // ========== P0-2 全屏预览承载层（新） ==========
  /** 注入到全屏预览承载层内的产品预览内容（文字类=锁定版式 / PPT=放映态 / H5=运行态）。
   *  传了即走"全屏预览"（选 B：框架统一接管）；不传则 fallback 老行为（切文档模式）。 */
  previewSlot?: ReactNode
  /** 预览层标题 */
  previewTitle?: string

  // ========== P0-6 统一 footer（新，可选） ==========
  /** 统一 footer 配置：传了即用框架渲染的 保存草稿 / 发布 按钮，取代 footerLeft/footerRight（渐进迁移） */
  footerLifecycle?: {
    saveDraftLabel: string
    publishLabel: string
    onSaveDraft: () => void
    onPublish: () => void
    status?: EditorStatus
    saving?: boolean
  }
  /** footer 对齐：'full'=横跨整页底部（默认），'left'=限制到左栏宽度 466px（贴左对齐） */
  footerAlign?: 'full' | 'left'
}

/** 框架固定模式标签，四场景一致，页面不可覆盖（防漂移成"编辑/预览模式"） */
const FRAME_MODE_LABELS: [string, string] = ['AI 模式', '文档模式']

export default function EditorLayout({
  mode, onModeChange, modeLocked, modeLockedLabel, modeLabels,
  primaryLeft, primaryRight, secondaryLeft, secondaryRight,
  sceneName,
  footerExtra, footerLeft, footerRight, hidePreviewBtn, onPreview,
  previewSlot, previewTitle, footerLifecycle, footerAlign,
  previewOpen: previewOpenProp, onPreviewChange, onPreviewEdit,
}: Props) {
  // 受控预览：传了 previewOpen 则由页面持有状态，否则框架内部自管理
  const previewControlled = previewOpenProp !== undefined
  const [previewInner, setPreviewInner] = useState(false)
  const previewOpen = previewControlled ? previewOpenProp : previewInner
  const setPreviewOpen = (o: boolean) => {
    if (previewControlled) onPreviewChange?.(o)
    else setPreviewInner(o)
  }
  const isPrimary = mode === 'primary'
  const currentLeft = isPrimary ? primaryLeft : secondaryLeft
  const currentRight = isPrimary ? primaryRight : secondaryRight
  const useNewPreview = !!previewSlot

  // 顶栏内置模式切换（框架固定标签，页面不可覆盖）
  const headerCenter = modeLocked && modeLockedLabel ? (
    <span className="px-4 py-1.5 text-[12px] text-white/80 bg-white/10 rounded-[4px] border border-white/20 font-medium">
      {modeLockedLabel}
    </span>
  ) : (
    <div className="inline-flex rounded-[4px] border border-white/20 overflow-hidden bg-white/10">
      <button
        onClick={() => { if (!modeLocked) onModeChange?.('primary') }}
        className={`px-4 py-1.5 text-[12px] transition-colors ${
          isPrimary
            ? 'bg-white text-[#1A3A6B] font-medium'
            : 'text-white/70 hover:text-white'
        } ${modeLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {modeLabels?.[0] || FRAME_MODE_LABELS[0]}
      </button>
      <button
        onClick={() => { if (!modeLocked) onModeChange?.('secondary') }}
        className={`px-4 py-1.5 text-[12px] border-l border-white/20 transition-colors ${
          !isPrimary
            ? 'bg-white text-[#1A3A6B] font-medium'
            : 'text-white/70 hover:text-white'
        } ${modeLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {modeLabels?.[1] || FRAME_MODE_LABELS[1]}
      </button>
    </div>
  )

  // 预览按钮点击：新行为开全屏 overlay；旧行为切文档模式（fallback）
  const handlePreviewClick = () => {
    if (modeLocked) return
    if (useNewPreview) { setPreviewOpen(true); return }
    if (mode === 'primary') {
      if (onPreview) onPreview()
      else onModeChange?.('secondary')
    } else {
      onModeChange?.('primary')
    }
  }
  // 预览按钮文案：新行为恒"预览"（overlay 自带返回）；旧行为按 mode 切换
  const previewLabel = useNewPreview ? '预览' : (isPrimary ? '预览' : '返回编辑')

  // 是否有任何 footer 内容需要渲染
  const hasFooter = footerExtra || footerLeft || footerRight || footerLifecycle

  // 统一 footer 按钮：P0-6(footerLifecycle) 与 旧版(footerLeft+预览+footerRight) 共用一套渲染
  const footerButtons = footerLifecycle ? (
    <>
      <button
        onClick={footerLifecycle.onSaveDraft}
        disabled={footerLifecycle.saving}
        className="flex-1 px-4 py-2.5 text-[13px] text-white bg-[#02A7F0] rounded-[4px] hover:bg-[#0288D1] disabled:opacity-50 transition-colors"
      >
        {footerLifecycle.saveDraftLabel}
      </button>
      {!hidePreviewBtn && (
        <button
          onClick={handlePreviewClick}
          disabled={modeLocked}
          className="flex-1 px-4 py-2.5 text-[13px] text-[#353535] border border-[#E7E7EB] rounded-[4px] hover:border-[#02A7F0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {previewLabel}
        </button>
      )}
      <button
        onClick={footerLifecycle.onPublish}
        disabled={footerLifecycle.saving}
        className="flex-1 px-4 py-2.5 text-[13px] text-[#353535] border border-[#E7E7EB] rounded-[4px] hover:border-[#02A7F0] disabled:opacity-50 transition-colors"
      >
        {footerLifecycle.publishLabel}
      </button>
    </>
  ) : (
    <>
      {footerLeft}
      {!hidePreviewBtn && (
        <button
          onClick={handlePreviewClick}
          disabled={modeLocked}
          className="flex-1 px-4 py-2.5 text-[13px] text-[#353535] border border-[#E7E7EB] rounded-[4px] hover:border-[#02A7F0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {previewLabel}
        </button>
      )}
      {footerRight}
    </>
  )

  // footer 是否嵌在左栏底部（对齐='left'）
  const footerInLeft = (footerAlign ?? 'full') === 'left'

  const previewCtx = useMemo(() => ({ openPreview: () => setPreviewOpen(true) }), [setPreviewOpen])
  return (
    <PreviewCtx.Provider value={previewCtx}>
    <div className="flex flex-col h-screen bg-[#F6F7F8]">
      {/* Header */}
      <header className="h-12 bg-[#212529] flex items-center pl-3 pr-5 shrink-0">
        <LogoText>
          <span className="font-normal ml-1"> - 工作台{sceneName ? ` · ${sceneName}` : ''}</span>
        </LogoText>
        <div className="flex-1 flex justify-center">
          {headerCenter}
        </div>
        <HeaderRight variant="dark" />
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Panel — 固定 466px，不可收起（四场景一致） */}
        <div className="relative bg-white border-r border-[#E7E7EB] flex flex-col shrink-0 w-[466px]">
          <div className="flex-1 min-h-0 overflow-hidden">
            {currentLeft}
          </div>
          {/* 左栏底部 footer（对齐='left' 时嵌在左栏底，与基本信息/小微入口同列） */}
          {footerInLeft && hasFooter && (
            <div className="shrink-0 border-t border-[#F0F0F0] bg-white px-5 py-3 flex gap-3">
              {footerExtra}
              {footerButtons}
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div className="flex-1 bg-white overflow-hidden flex flex-col">
          {currentRight}
        </div>
      </div>

      {/* Unified Footer — 底部全宽条：仅当 footer 不在左栏内时渲染 */}
      {hasFooter && !footerInLeft && (
        <div className={`shrink-0 border-t border-[#F0F0F0] bg-white ${(footerAlign ?? 'full') === 'left' ? 'w-[466px]' : 'w-full'}`}>
          {footerExtra}
          <div className="px-5 py-3 flex gap-3">
            {footerButtons}
          </div>
        </div>
      )}

      {/* P0-2 全屏预览承载层 */}
      {useNewPreview && (
        <PreviewOverlay open={previewOpen} title={previewTitle} onClose={() => setPreviewOpen(false)} onEdit={onPreviewEdit}>
          {previewSlot}
        </PreviewOverlay>
      )}
    </div>
    </PreviewCtx.Provider>
  )
}
