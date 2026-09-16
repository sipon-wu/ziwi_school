/**
 * 批注 / 版本面板（2026-09-16 从 CoursewareBuilder.tsx 抽出的第一个共用组件）
 *
 * ★ 为什么先抽它：这块 UI 在页面里被**复制了 3 份**（编辑态右侧浮层、查看态右栏、全屏浮层），
 *   三份各自带着 cwAnnText / cwAnnTab / cwHistoryVisible 三个状态和
 *   addCwAnnotation / takeCwSnapshot / restoreCwSnapshot 三个处理函数。
 *   抽出来后：这 6 个符号全部下放进组件，三处调用点各少约 10 个依赖。
 *
 * 三种形态由 props 控制（原本是三份各写各的 JSX）：
 *   · className   —— 外层容器（编辑态是 absolute 浮层 220px，查看态/全屏是 relative 常驻栏）
 *   · readOnly    —— 查看态：不显示批注输入框、不显示删除、不显示存版本/恢复
 *   · onCollapse  —— 传了才显示"收起"按钮（浮层形态用，常驻栏没有）
 *
 * 拆分原则（同 P0-1 六刀）：行为逐行搬迁，不改逻辑、不改视觉。
 * 注：cwAnn / cwVer **不能**下放 —— 版本源还被保存草稿与换风格（存快照前）读取，必须由父层持有。
 */
import { useState } from 'react'
import { ChevronLeft, History, MessageSquare, Plus, RotateCcw, X } from 'lucide-react'
import { useToast } from './Toast'
import { useAnnotations, useVersions } from '../hooks/useAnnotations'
import type { OutlineSlide } from '../lib/exportPptx'

export interface CwAnnotationsPanelProps {
  /** 外层容器 class：调用方决定是 absolute 浮层还是 relative 常驻栏 */
  className?: string
  /** 只读（查看态）：不显示批注输入框 / 删除 / 存版本 / 恢复 */
  readOnly?: boolean
  /** 传了才在页签栏显示"收起"按钮（浮层形态用） */
  onCollapse?: () => void
  cwAnn: ReturnType<typeof useAnnotations>
  cwVer: ReturnType<typeof useVersions>
  cwAnnTargetId: string
  cwLocked: boolean
  materialId: string
  cwOutline: OutlineSlide[]
  setCwOutline: React.Dispatch<React.SetStateAction<OutlineSlide[]>>
  /** 整本页序（0 = 封面） */
  deckIdx: number
  /** 正文页下标（批注按 docSlide+1 锚定，已存库，不可改语义） */
  docSlide: number
}

export function CwAnnotationsPanel({
  className = '', readOnly = false, onCollapse,
  cwAnn, cwVer, cwAnnTargetId, cwLocked, materialId, cwOutline, setCwOutline, deckIdx, docSlide,
}: CwAnnotationsPanelProps) {
  const { toast } = useToast()
  // 原为父层状态：仅服务于本面板，故下放
  const [annText, setAnnText] = useState('')
  const [tab, setTab] = useState<'annotations' | 'history'>('annotations')

  const addAnnotation = () => {
    if (!annText.trim() || !cwAnnTargetId) return
    // 封面页不参与按页批注（2026-09-15）：批注按正文页号锚定（docSlide+1），而封面不属于 outline，
    // 若允许在封面写批注会错锚到正文第 1 页 —— 这里直接拦掉，提示教师切到正文页。
    if (deckIdx === 0) { toast('封面页不支持按页批注，请切到正文页', 'warning'); return }
    cwAnn.add('page', { page: docSlide + 1, pageTitle: cwOutline[docSlide]?.title || '' }, annText.trim())
    setAnnText('')
  }
  const takeSnapshot = async () => {
    if (!materialId) return
    const ok = await cwVer.take('课件快照', cwOutline)
    if (!ok) toast('已发布定版或保存失败', 'warning')
  }
  const restoreSnapshot = async (versionId: string) => {
    const payload = await cwVer.restore(versionId)
    if (payload == null) { toast('已发布定版，不可回退版本', 'warning'); return }
    if (Array.isArray(payload) && payload.length) { setCwOutline(payload as OutlineSlide[]); toast('已恢复到该版本', 'success') }
  }

  return (
    <div className={className}>
      <div className="flex border-b border-[#F0F0F0] shrink-0">
        <button onClick={() => setTab('annotations')}
          className={`flex-1 py-2 text-[11px] font-medium text-center border-b-2 transition-colors ${tab === 'annotations' ? 'border-[#02A7F0] text-[#02A7F0] bg-white' : 'border-transparent text-[#9A9A9A] hover:text-[#595959]'}`}>
          <MessageSquare size={11} className="inline mr-1" />批注
        </button>
        <button onClick={() => setTab('history')}
          className={`flex-1 py-2 text-[11px] font-medium text-center border-b-2 transition-colors ${tab === 'history' ? 'border-[#02A7F0] text-[#02A7F0] bg-white' : 'border-transparent text-[#9A9A9A] hover:text-[#595959]'}`}>
          <History size={11} className="inline mr-1" />版本
        </button>
        {onCollapse && (
          <button onClick={onCollapse} title="收起批注栏" className="px-2 text-[#C0C0C0] hover:text-[#9A9A9A]">
            <ChevronLeft size={12} style={{ transform: 'rotate(180deg)' }} />
          </button>
        )}
      </div>

      {tab === 'annotations' && (
        readOnly ? (
          <div className="flex-1 overflow-y-auto">
            {cwAnn.items.length === 0 ? (
              <p className="text-[11px] text-[#C0C0C0] text-center py-4">暂无批注</p>
            ) : (
              cwAnn.items.map((a: any) => {
                let pageLabel = ''
                try { pageLabel = 'P' + (JSON.parse(a.anchor || '{}').page || '?') } catch { /* noop */ }
                return (
                  <div key={a.id} className="p-2 border-b border-[#F5F5F5] hover:bg-[#F0F2F5]">
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-[11px] text-[#1A3A6B] bg-[#E3ECFA] px-1.5 py-0.5 rounded">{pageLabel}</span>
                    </div>
                    <p className="text-[11px] text-[#595959] mt-1 leading-relaxed">{a.comment}</p>
                    <span className="text-[9px] text-[#C0C0C0]">{a.created_at?.slice(0, 16).replace('T', ' ')}</span>
                  </div>
                )
              })
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-2 border-b border-[#F0F0F0] bg-white shrink-0">
              <p className="text-[10px] text-[#9A9A9A] mb-1.5">{deckIdx === 0 ? '封面页：不支持按页批注（封面内容由左栏字段驱动）' : `对第 ${docSlide + 1} 页写批注：`}</p>
              <textarea
                value={annText}
                onChange={e => setAnnText(e.target.value)}
                rows={2}
                placeholder="输入批注..."
                className="w-full px-2 py-1 text-[11px] border border-[#E7E7EB] rounded focus:border-[#02A7F0] outline-none resize-none"
              />
              <button onClick={addAnnotation}
                disabled={!annText.trim()}
                className="w-full mt-1.5 py-1 text-[11px] text-white bg-[#02A7F0] rounded hover:bg-[#0398D8] disabled:opacity-40 flex items-center justify-center gap-1">
                <Plus size={10} /> 添加批注
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {cwAnn.items.length === 0 ? (
                <p className="text-[11px] text-[#C0C0C0] text-center py-4">暂无批注</p>
              ) : (
                cwAnn.items.map((a: any) => {
                  let pageLabel = ''
                  try { pageLabel = 'P' + (JSON.parse(a.anchor || '{}').page || '?') } catch { /* noop */ }
                  return (
                    <div key={a.id} className="p-2 border-b border-[#F5F5F5] hover:bg-[#F0F2F5]">
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-[11px] text-[#1A3A6B] bg-[#E3ECFA] px-1.5 py-0.5 rounded">{pageLabel}</span>
                        <button onClick={() => cwAnn.remove(a.id)} className="text-[#C0C0C0] hover:text-red-400 shrink-0"><X size={10} /></button>
                      </div>
                      <p className="text-[11px] text-[#595959] mt-1 leading-relaxed">{a.comment}</p>
                      <span className="text-[9px] text-[#C0C0C0]">{a.created_at?.slice(0, 16).replace('T', ' ')}</span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )
      )}

      {tab === 'history' && (
        // 查看态（readOnly）原本就只有一句定版提示，没有版本列表 —— 保持原行为不变
        readOnly ? (
          <div className="flex-1 overflow-y-auto py-1">
            {cwLocked ? (
              <p className="text-[10px] text-[#9A9A9A] px-3 py-2">已发布定版，版本仅供查看</p>
            ) : null}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto py-1">
            {cwLocked ? (
              <p className="text-[10px] text-[#9A9A9A] px-3 py-2">已发布定版，版本仅供查看，不可存/回退</p>
            ) : (
              <>
                <button onClick={() => takeSnapshot()}
                  className="w-full text-left px-3 py-1.5 text-[11px] text-[#02A7F0] hover:bg-[#F0F2F5] flex items-center gap-1">
                  <Plus size={10} /> 保存当前版本
                </button>
                <div className="border-t border-[#F0F0F0] my-1" />
              </>
            )}
            {cwVer.items.length === 0 ? (
              <p className="text-[11px] text-[#C0C0C0] px-3 py-2">暂无版本记录</p>
            ) : (
              cwVer.items.map((s: any) => (
                <div key={s.id} className="px-3 py-1.5 hover:bg-[#F0F2F5] border-b border-[#F5F5F5]">
                  <div className="flex items-center justify-between gap-1">
                    <span className="flex items-center gap-1 min-w-0">
                      <span className={`shrink-0 px-1 rounded text-[9px] ${s.kind === 'release' ? 'bg-[#EAF3FF] text-[#1A5FB4]' : 'bg-[#F2F3F5] text-[#8C8C8C]'}`}>
                        {s.kind === 'release' ? '发布版' : '快照'}
                      </span>
                      <span className="text-[11px] text-[#353535] truncate">{s.created_at?.slice(0, 16).replace('T', ' ')}</span>
                    </span>
                    <span className="text-[9px] text-[#C0C0C0] truncate max-w-[96px]">{s.label}</span>
                  </div>
                  {!cwLocked && (
                    <div className="flex gap-2 mt-0.5">
                      <button onClick={() => restoreSnapshot(s.id)} className="text-[10px] text-[#02A7F0] hover:underline flex items-center gap-0.5">
                        <RotateCcw size={9} />恢复
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )
      )}
    </div>
  )
}
