/**
 * 查看态 / 只读放映区（2026-09-16 从 CoursewareBuilder.tsx 抽出，抽组件 Step 3b）
 *
 * 结构：左侧整本目录 → 中间只读放映（含当页互动只读渲染）→ 右侧（H5 扫码分享 或 批注/版本只读面板）。
 * 在页面里被 4 处引用（非全屏 secondaryRight、全屏 previewSlot、H5 主画布、查看态 previewSlot）。
 *
 * ★ 右侧为什么按"状态"而不是"格式"分
 *   （2026-09-15 修）：此前按格式分（cwFormat === 'h5' 一律扫码栏），而 H5 编辑态的画布
 *   又复用本区块，于是教师**编辑**时右侧也一直是二维码 —— 二维码是"扫码到手机预览"的东西，
 *   编辑时要的是批注/版本。故改为按状态分，由 `showShare` 决定。
 *
 * props 归组：批注面板要的 9 个值收成一个 `ann` 对象（与 CwLeftPanel 的 `gen` 同理），
 * 避免 20 个平铺 props。
 */
import type React from 'react'
import { Smartphone } from 'lucide-react'
import { CwAnnotationsPanel } from './CwAnnotationsPanel'
import { useToast } from './Toast'
import { isValidComponent, type CwSlide, type OutlineSlide } from '../lib/exportPptx'
import { renderInteractive, type H5Slide } from '../lib/exportH5'
import type { useAnnotations, useVersions } from '../hooks/useAnnotations'

export interface CwPreviewPaneProps {
  cwFormat: 'ppt' | 'h5' | 'video'
  cwH5Html: string
  /** 整本放映页（previewSlides，由 useCwPreview 提供） */
  previewSlides: CwSlide[] | null
  cwOutline: OutlineSlide[]
  /** 整本页序（0 = 封面） */
  deckIdx: number
  onSelect: (i: number) => void
  buildH5Slides: () => H5Slide[]
  /** 中间只读放映主体（父层构造的 previewSlideElems） */
  slideElems: React.ReactNode
  /** 是否显示右侧扫码分享栏（H5 且处于查看/放映态） */
  showShare: boolean
  h5ShareQr: { url: string; dataUrl: string } | null
  /** 右侧批注/版本面板所需（只读态） */
  ann: {
    cwAnn: ReturnType<typeof useAnnotations>
    cwVer: ReturnType<typeof useVersions>
    cwAnnTargetId: string
    cwLocked: boolean
    materialId: string
    cwOutline: OutlineSlide[]
    setCwOutline: React.Dispatch<React.SetStateAction<OutlineSlide[]>>
    deckIdx: number
    docSlide: number
  }
}

export function CwPreviewPane({
  cwFormat, cwH5Html, previewSlides, cwOutline, deckIdx, onSelect,
  buildH5Slides, slideElems, showShare, h5ShareQr, ann,
}: CwPreviewPaneProps) {
  const { toast } = useToast()
  const deck = previewSlides || cwOutline
  // 封面**不计入页数**（2026-09-17 产品定）：previewSlides 含系统合成的封面（slides[0]，不在 cwOutline 内），
  // 故正文页数 = previewSlides.length - 1；回退用的 cwOutline 本身就不含封面。
  // 与质量报告 check_markdown(markdown).pages 的口径一致（markdown 里没有合成封面）。
  const contentCount = previewSlides ? Math.max(0, previewSlides.length - 1) : cwOutline.length
  const isH5Story = cwFormat === 'h5' && !!cwH5Html

  return (
    <div className="flex-1 flex overflow-hidden bg-[#FAFAFA] h-full">
      {/* 左：只读缩略图页导航（H5 绘本态隐藏左侧目录，让整本绘本占据视口） */}
      {!isH5Story && (
        <div className="w-44 shrink-0 overflow-y-auto border-r border-[#E7E7EB] bg-white p-2 space-y-1.5">
          <div className="px-1 pb-1 text-[11px] font-medium text-[#353535]">页面（{contentCount}）</div>
          {/* 目录也按整本列（含封面，2026-09-15）：此前只列 outline → 左栏没有"封面"这一项，
              右侧放映却可能停在封面上，两边对不上。现在目录项 = 整本页序（封面 + 正文）。 */}
          {deck.map((s, idx) => (
            <div key={idx} onClick={() => onSelect(idx)}
              className={`cursor-pointer rounded-[4px] border p-1.5 ${idx === deckIdx ? 'border-[#02A7F0] bg-[#E8F7FF]' : 'border-[#E7E7EB] hover:bg-[#F6F7F8]'}`}>
              <span className="text-[10px] text-[#9A9A9A]">{idx === 0 ? '封面' : `P${idx}`}</span>
              <p className="text-[11px] text-[#353535] truncate mt-0.5">{s.title || '（无标题）'}</p>
            </div>
          ))}
        </div>
      )}
      {/* 中：可滚动只读放映 + 当前页互动（预览态只只读渲染，编辑按钮统一在编辑态文档模式右栏） */}
      <div className={isH5Story ? 'flex-1 h-full p-0' : 'flex-1 overflow-y-auto px-6 py-4'}>
        {!isH5Story && (
          <>
            <div className="mb-3 text-[12px] text-[#9A9A9A]">预览模式（只读）· {deckIdx === 0 ? '封面' : `第 ${deckIdx}/${contentCount} 页`}</div>
            {(() => {
              // 只读放映：只渲染当页互动的只读组件，不显示任何编辑按钮
              // 注：deckIdx 含封面，而 buildH5Slides() 只有正文页 → 取 deckIdx-1（封面页无互动）
              const roIt = buildH5Slides()[Math.max(0, deckIdx - 1)]?.interactive
              const roHtml = isValidComponent(roIt) ? renderInteractive(roIt) : ''
              return (
                <div className="mb-4">
                  {roHtml ? (
                    <div className="border border-[#E7E7EB] rounded bg-white p-3" dangerouslySetInnerHTML={{ __html: roHtml }} />
                  ) : (
                    <p className="text-[11px] text-[#C0C0C0] mb-3">本页无互动组件。互动课件需在「编辑」态挂接，发布后在此以只读形式呈现并可投屏/扫码交互。</p>
                  )}
                </div>
              )
            })()}
          </>
        )}
        {slideElems}
      </div>
      {/* 右：H5 **预览/查看态** → 扫码分享；编辑态与 PPT 一致 → 批注 / 版本（按状态而非格式分，见文件头） */}
      {showShare ? (
        <div className="w-[260px] shrink-0 border-l border-[#E7E7EB] bg-[#FAFBFC] flex flex-col overflow-hidden z-20">
          <div className="px-3 py-2 text-[11px] font-medium text-[#353535] border-b border-[#F0F0F0] bg-white shrink-0 flex items-center gap-1">
            <Smartphone size={11} /> 手机扫码查看
          </div>
          <div className="flex-1 flex flex-col items-center justify-center px-4 py-5">
            {h5ShareQr ? (
              <>
                <div className="bg-white rounded-xl p-3 shadow-sm border border-[#EEE]">
                  <img src={h5ShareQr.dataUrl} alt="扫码查看" className="w-[180px] h-[180px] block" />
                </div>
                <p className="text-[11px] text-[#888] text-center mt-3 leading-relaxed">手机扫码在浏览器打开，可翻页 / 点读 / 互动，也可投屏上课。</p>
                <button onClick={() => { try { navigator.clipboard?.writeText(h5ShareQr.url) } catch { /* noop */ } toast('链接已复制', 'success') }}
                  className="mt-3 px-3 py-1.5 text-[11px] text-[#02A7F0] border border-[#02A7F0] rounded hover:bg-[#E8F7FF]">复制链接</button>
              </>
            ) : (
              <p className="text-[11px] text-[#C0C0C0] text-center leading-relaxed">发布后生成扫码链接，<br />手机扫码即可查看互动课件。</p>
            )}
          </div>
        </div>
      ) : ann.cwAnnTargetId && (
        <CwAnnotationsPanel readOnly
          className="relative w-[260px] shrink-0 border-l border-[#E7E7EB] bg-[#FAFBFC] flex flex-col z-20 overflow-hidden"
          cwAnn={ann.cwAnn} cwVer={ann.cwVer} cwAnnTargetId={ann.cwAnnTargetId} cwLocked={ann.cwLocked}
          materialId={ann.materialId} cwOutline={ann.cwOutline} setCwOutline={ann.setCwOutline}
          deckIdx={ann.deckIdx} docSlide={ann.docSlide}
          />
      )}
    </div>
  )
}
