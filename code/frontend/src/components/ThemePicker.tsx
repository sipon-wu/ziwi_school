import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTeaching } from '../lib/TeachingContext'
import {
  THEME_GROUPS,
  getTheme,
  recommendTheme,
  GRADE_BAND_LABEL,
  type CwTheme,
} from '../lib/pptThemes'

interface Props {
  value: string
  onChange: (id: string) => void
}

export default function ThemePicker({ value, onChange }: Props) {
  const teaching = useTeaching()
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  // 弹层屏幕坐标：用 fixed 定位 + Portal 渲染到 body，脱离父级 stacking context，
  // 彻底避免被批注栏（z-20、DOM 靠后）等同层浮层按 DOM 顺序覆盖遮挡
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  // 按当前学科 + 年级推荐（仅推荐，不强制）
  const rec = recommendTheme(teaching.subject, teaching.grade)
  const recTheme = getTheme(rec.themeId)

  const pick = (id: string) => {
    onChange(id)
    setOpen(false)
  }

  // 打开时基于按钮屏幕坐标定位；滚动/缩放时重新计算；点外部关闭
  useEffect(() => {
    if (!open) { setPos(null); return }
    const recalc = () => {
      const r = btnRef.current?.getBoundingClientRect()
      if (!r) return
      const POPUP_W = 300
      // 弹层宽 300px，右对齐到按钮右沿；如右侧空间不足则改为左对齐并贴右边距
      const left = Math.max(8, Math.min(window.innerWidth - POPUP_W - 8, r.right - POPUP_W))
      setPos({ top: r.bottom + 6, left })
    }
    recalc()
    window.addEventListener('resize', recalc)
    window.addEventListener('scroll', recalc, true)
    const onDocClick = (e: MouseEvent) => {
      if (!btnRef.current?.contains(e.target as Node)) setOpen(false)
    }
    // 下一帧再绑，避免本次点击立即冒泡触发关闭
    const t = setTimeout(() => document.addEventListener('mousedown', onDocClick), 0)
    return () => {
      window.removeEventListener('resize', recalc)
      window.removeEventListener('scroll', recalc, true)
      clearTimeout(t)
      document.removeEventListener('mousedown', onDocClick)
    }
  }, [open])

  return (
    <div className="relative">
      <button
        ref={btnRef}
        data-testid="theme-picker-toggle"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-[#E0E0E6] bg-white text-[13px] text-[#333] hover:border-[#02A7F0] transition-colors"
      >
        <span
          className="inline-block w-3.5 h-3.5 rounded-sm"
          style={{ background: `#${getTheme(value).primary}` }}
        />
        <span>模板</span>
        <span className="text-[#02A7F0] font-medium">{getTheme(value).name}</span>
        <span className="text-[#AAA] text-[11px]">▾</span>
      </button>

      {open && pos && createPortal(
        <div data-testid="theme-picker-popup"
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 60 }}
          className="w-[300px] max-h-[420px] overflow-y-auto bg-white rounded-lg shadow-xl border border-[#EDEDF0] p-3">
          {/* 置顶：为你推荐（按学科 + 学段观感，推荐不强制） */}
          <div className="mb-3 pb-3 border-b border-[#EDEDF0]">
            <p className="text-[11px] font-medium text-[#02A7F0] mb-1.5 flex items-center gap-1">
              <span>🎯 为你推荐</span>
              <span className="text-[#9A9A9A] font-normal">
                · {teaching.subject} · {GRADE_BAND_LABEL[rec.band]}
              </span>
            </p>
            <button
              onClick={() => pick(rec.themeId)}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-md border border-[#02A7F0] bg-[#E8F7FF] hover:bg-[#D6EEFB] transition-colors"
            >
              <span
                className="inline-block w-5 h-5 rounded-sm shrink-0"
                style={{ background: `#${recTheme.primary}` }}
              />
              <span className="text-[13px] text-[#333] font-medium">{recTheme.name}</span>
              <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-[#02A7F0] text-white shrink-0">
                推荐
              </span>
            </button>
          </div>

          {THEME_GROUPS.map(g => (
            <div key={g.id} className="mb-3 last:mb-0">
              <p className="text-[11px] font-medium text-[#9A9A9A] mb-1.5">{g.name}</p>
              <div className="grid grid-cols-2 gap-1.5">
                {g.themes.map((t: CwTheme) => {
                  const active = t.id === value
                  const isRec = t.id === rec.themeId
                  return (
                    <button
                      key={t.id}
                      onClick={() => pick(t.id)}
                      className={[
                        'relative flex items-center gap-1.5 px-2 py-1.5 rounded-md border text-[12px] transition-colors',
                        active
                          ? 'border-[#02A7F0] bg-[#E8F7FF] text-[#333]'
                          : 'border-[#EDEDF0] hover:border-[#C9A6F0] text-[#555]',
                      ].join(' ')}
                    >
                      <span
                        className="inline-block w-3.5 h-3.5 rounded-sm shrink-0"
                        style={{ background: `#${t.primary}` }}
                      />
                      <span className="truncate">{t.name}</span>
                      {isRec && (
                        <span className="ml-auto text-[9px] px-1 py-0.5 rounded bg-[#02A7F0]/10 text-[#02A7F0] shrink-0">
                          荐
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}
