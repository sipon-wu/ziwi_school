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
import { useEffect, useRef, useState, type ReactNode, type Dispatch, type SetStateAction } from 'react'
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
  slideElems: ReactNode
  /** 是否显示右侧扫码分享栏（H5 且处于查看/放映态） */
  showShare: boolean
  h5ShareQr: { url: string; dataUrl: string } | null
  /**
   * 放映态（查看态）启用「一键纯净」：隐藏左右两侧（目录 + 批注/扫码），画布居中于深底，
   * 底部悬浮控制条（翻页/页码/退出，鼠标静止 3s 自动淡出），键盘 ←→/空格 翻页、Esc 退出纯净。
   * 2026-09-18 用户拍板：放映态**默认即纯净**（主流：飞书/Google Slides/腾讯文档放映零侧栏、控制条按需浮现），
   * **H5 查看态同样默认纯净**（用户复核：「也可纯净」）——原"扫码栏默认可见"的例外已取消；
   * 扫码分享仍可用：点「退出纯净」即浮现（右栏=手机扫码查看）。
   */
  puri?: boolean
  /** 上报沉浸态给外层（pure=是否纯净；hud=控制条/标题栏是否可见），供放映外壳标题栏同步淡出 */
  onImmersive?: (v: { pure: boolean; hud: boolean }) => void
  /** 右侧批注/版本面板所需（只读态） */
  ann: {
    cwAnn: ReturnType<typeof useAnnotations>
    cwVer: ReturnType<typeof useVersions>
    cwAnnTargetId: string
    cwLocked: boolean
    materialId: string
    cwOutline: OutlineSlide[]
    setCwOutline: Dispatch<SetStateAction<OutlineSlide[]>>
    deckIdx: number
    docSlide: number
  }
}

export function CwPreviewPane({
  cwFormat, cwH5Html, previewSlides, cwOutline, deckIdx, onSelect,
  buildH5Slides, slideElems, showShare, h5ShareQr, ann, puri = false, onImmersive,
}: CwPreviewPaneProps) {
  const { toast } = useToast()
  const deck = previewSlides || cwOutline
  // 封面**不计入页数**（2026-09-17 产品定）：previewSlides 含系统合成的封面（slides[0]，不在 cwOutline 内），
  // 故正文页数 = previewSlides.length - 1；回退用的 cwOutline 本身就不含封面。
  // 与质量报告 check_markdown(markdown).pages 的口径一致（markdown 里没有合成封面）。
  const contentCount = previewSlides ? Math.max(0, previewSlides.length - 1) : cwOutline.length
  const isH5Story = cwFormat === 'h5' && !!cwH5Html
  // ── 一键纯净放映（2026-09-18）────────────────────────────────────────
  // 默认纯净（用户拍板）：放映态进来即纯净（左右侧同时隐藏）——PPT 与 H5 一致（用户复核「也可纯净」）。
  // 控制条与外壳标题栏随鼠标静止 3s 自动淡出、移动即浮现（对齐飞书/Google Slides 放映）。
  const [pure, setPure] = useState(!!puri)
  const [hud, setHud] = useState(true)
  const lastIdx = Math.max(0, deck.length - 1)
  // 查看态下本组件会被挂两份（背后布局一份 + 放映外壳里一份，同一个 previewPane 元素），
  // 二者共用全局监听会互相打架（例：外壳里退出纯净后，背后那份仍报 pure=true → 标题栏被误淡出）。
  // 故只有**位于放映外壳（fixed inset-0）内**的那份实例才接管键盘与沉浸态上报。
  const rootRef = useRef<HTMLDivElement>(null)
  const [inShell, setInShell] = useState(false)
  useEffect(() => {
    let el: HTMLElement | null = rootRef.current
    while (el && !(el.classList.contains('fixed') && el.classList.contains('inset-0'))) el = el.parentElement
    setInShell(!!el)
  }, [])
  const present = puri && inShell
  // 上报沉浸态：外层用它在纯净+静止时淡出放映外壳标题栏（主流"放映零 chrome"）
  useEffect(() => { if (present) onImmersive?.({ pure, hud }) }, [present, pure, hud, onImmersive])
  useEffect(() => {
    if (!pure) { setHud(true); return }
    let timer: ReturnType<typeof setTimeout>
    const wake = () => { setHud(true); clearTimeout(timer); timer = setTimeout(() => setHud(false), 3000) }
    window.addEventListener('mousemove', wake)
    wake()
    return () => { clearTimeout(timer); window.removeEventListener('mousemove', wake) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pure])
  // 键盘（仅放映外壳内那份实例，避免双实例重复翻页）：Esc 退出纯净 · ←→↑↓/空格 翻页
  useEffect(() => {
    if (!present || !pure) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setPure(false); return }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); onSelect(Math.min(lastIdx, deckIdx + 1)) }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); onSelect(Math.max(0, deckIdx - 1)) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [present, pure, deckIdx, lastIdx, onSelect])

  return (
    <div ref={rootRef} className="relative flex-1 flex overflow-hidden bg-[#FAFAFA] h-full">
      {/* 左：只读缩略图页导航（H5 绘本态隐藏左侧目录，让整本绘本占据视口；纯净态一并隐藏） */}
      {!isH5Story && !pure && (
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
      <div className={pure ? 'flex-1 h-full flex items-center justify-center bg-[#0F1115] p-2' : isH5Story ? 'flex-1 h-full p-0' : 'flex-1 overflow-y-auto px-6 py-4'}>
        {!isH5Story && !pure && (
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
      {/* 右：H5 **预览/查看态** → 扫码分享；编辑态与 PPT 一致 → 批注 / 版本（按状态而非格式分，见文件头）。
          纯净态一并隐藏（一键纯净 = 左右侧同时收）。 */}
      {!pure && (showShare ? (
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
      ))}
      {/* 一键纯净（放映态）：右上角入口；纯净中鼠标静止 3s 后与控制条一起淡出，移动鼠标即恢复 */}
      {puri && (
        <button onClick={() => setPure(v => !v)} title={pure ? '退出纯净放映（Esc）' : '一键纯净：隐藏左右两侧（放映）'}
          className={`absolute right-3 top-3 z-30 px-2.5 py-1 rounded-full text-[11px] shadow-lg ring-1 ring-white/20 bg-[#212529]/85 text-white hover:bg-[#212529] transition-opacity ${pure && !hud ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          {pure ? '退出纯净' : '⛶ 纯净放映'}
        </button>
      )}
      {/* 悬浮控制条（仅纯净态）：翻页 + 页码 + 退出；鼠标静止 3s 自动淡出（对齐飞书/Google Slides 放映） */}
      {puri && pure && (
        <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-3 py-1.5 rounded-full bg-[#212529]/85 text-white text-[12px] shadow-lg ring-1 ring-white/15 transition-opacity ${hud ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <button onClick={() => onSelect(Math.max(0, deckIdx - 1))} disabled={deckIdx <= 0} className="px-1 hover:text-[#02A7F0] disabled:opacity-30">◀</button>
          <span className="tabular-nums">{deckIdx === 0 ? '封面' : `${deckIdx}/${contentCount}`}</span>
          <button onClick={() => onSelect(Math.min(lastIdx, deckIdx + 1))} disabled={deckIdx >= lastIdx} className="px-1 hover:text-[#02A7F0] disabled:opacity-30">▶</button>
          <span className="w-px h-3.5 bg-white/25" />
          <button onClick={() => setPure(false)} className="hover:text-[#02A7F0]">退出纯净</button>
        </div>
      )}
    </div>
  )
}
