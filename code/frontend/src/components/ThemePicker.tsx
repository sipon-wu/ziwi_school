import { useState } from 'react'
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

  // 按当前学科 + 年级推荐（仅推荐，不强制）
  const rec = recommendTheme(teaching.subject, teaching.grade)
  const recTheme = getTheme(rec.themeId)

  const pick = (id: string) => {
    onChange(id)
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        data-testid="theme-picker-toggle"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-[#E0E0E6] bg-white text-[13px] text-[#333] hover:border-[#722ED1] transition-colors"
      >
        <span
          className="inline-block w-3.5 h-3.5 rounded-sm"
          style={{ background: `#${getTheme(value).primary}` }}
        />
        <span>模板</span>
        <span className="text-[#722ED1] font-medium">{getTheme(value).name}</span>
        <span className="text-[#AAA] text-[11px]">▾</span>
      </button>

      {open && (
        <div data-testid="theme-picker-popup" className="absolute z-30 mt-1.5 w-[300px] max-h-[420px] overflow-y-auto bg-white rounded-lg shadow-xl border border-[#EDEDF0] p-3">
          {/* 置顶：为你推荐（按学科 + 学段观感，推荐不强制） */}
          <div className="mb-3 pb-3 border-b border-[#EDEDF0]">
            <p className="text-[11px] font-medium text-[#722ED1] mb-1.5 flex items-center gap-1">
              <span>🎯 为你推荐</span>
              <span className="text-[#9A9A9A] font-normal">
                · {teaching.subject} · {GRADE_BAND_LABEL[rec.band]}
              </span>
            </p>
            <button
              onClick={() => pick(rec.themeId)}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-md border border-[#722ED1] bg-[#F7F0FF] hover:bg-[#EFE3FF] transition-colors"
            >
              <span
                className="inline-block w-5 h-5 rounded-sm shrink-0"
                style={{ background: `#${recTheme.primary}` }}
              />
              <span className="text-[13px] text-[#333] font-medium">{recTheme.name}</span>
              <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-[#722ED1] text-white shrink-0">
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
                          ? 'border-[#722ED1] bg-[#F7F0FF] text-[#333]'
                          : 'border-[#EDEDF0] hover:border-[#C9A6F0] text-[#555]',
                      ].join(' ')}
                    >
                      <span
                        className="inline-block w-3.5 h-3.5 rounded-sm shrink-0"
                        style={{ background: `#${t.primary}` }}
                      />
                      <span className="truncate">{t.name}</span>
                      {isRec && (
                        <span className="ml-auto text-[9px] px-1 py-0.5 rounded bg-[#722ED1]/10 text-[#722ED1] shrink-0">
                          荐
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
