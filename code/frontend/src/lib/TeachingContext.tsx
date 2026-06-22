import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'

// ── 类型定义 ──

export interface TeachingState {
  subject: '语文' | '数学' | '英语'
  grade: number // 1-9
  semester: '上' | '下'
  textbook_math: string // '人教版' | '北师大版' | '苏教版' | ...
  textbook_english: string // 'PEP' | '外研版' | '牛津版' | '冀教版'
  textbook_locked: boolean
  current_unit_name: string
  current_lesson_name: string
  progress_percent: number
}

const DEFAULT_STATE: TeachingState = {
  subject: '数学',
  grade: 4,
  semester: '下',
  textbook_math: '人教版',
  textbook_english: 'PEP',
  textbook_locked: true,
  current_unit_name: '第三单元: 运算定律',
  current_lesson_name: '第2课时: 乘法分配律',
  progress_percent: 37,
}

// ── 存储 Key ──
const STORAGE_KEY = 'zhiwei_teaching'

function loadState(): TeachingState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_STATE, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return DEFAULT_STATE
}

function saveState(state: TeachingState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

// ── Context ──

interface TeachingCtxValue extends TeachingState {
  setSubject: (s: TeachingState['subject']) => void
  setGrade: (g: number) => void
  setSemester: (s: TeachingState['semester']) => void
  setTextbookMath: (v: string) => void
  setTextbookEnglish: (v: string) => void
  setProgress: (unit: string, lesson: string, pct: number) => void
  reset: () => void
}

const TeachingCtx = createContext<TeachingCtxValue | null>(null)

export function TeachingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TeachingState>(loadState)

  useEffect(() => { saveState(state) }, [state])

  const setSubject = useCallback((s: TeachingState['subject']) => setState(prev => ({ ...prev, subject: s })), [])
  const setGrade = useCallback((g: number) => setState(prev => ({ ...prev, grade: g })), [])
  const setSemester = useCallback((s: TeachingState['semester']) => setState(prev => ({ ...prev, semester: s })), [])
  const setTextbookMath = useCallback((v: string) => setState(prev => ({ ...prev, textbook_math: v })), [])
  const setTextbookEnglish = useCallback((v: string) => setState(prev => ({ ...prev, textbook_english: v })), [])
  const setProgress = useCallback((unit: string, lesson: string, pct: number) =>
    setState(prev => ({ ...prev, current_unit_name: unit, current_lesson_name: lesson, progress_percent: pct })), [])
  const reset = useCallback(() => setState(DEFAULT_STATE), [])

  return (
    <TeachingCtx.Provider value={{ ...state, setSubject, setGrade, setSemester, setTextbookMath, setTextbookEnglish, setProgress, reset }}>
      {children}
    </TeachingCtx.Provider>
  )
}

export function useTeaching(): TeachingCtxValue {
  const ctx = useContext(TeachingCtx)
  if (!ctx) throw new Error('useTeaching must be used within TeachingProvider')
  return ctx
}

// ── AI 推荐服务 ──

export function getRecommendedDefaults(teaching: TeachingState) {
  const { subject, grade, semester, textbook_math } = teaching

  // 1. 时间智能推荐用途
  const day = new Date().getDay() // 0=周日
  const date = new Date().getDate()
  let purpose: string
  if (date > 25) purpose = 'monthly'
  else if (day === 4 || day === 5) purpose = 'homework'  // 周末作业
  else purpose = 'classwork'

  // 2. 用途 → 题量
  const countMap: Record<string, number> = { classwork: 5, homework: 8, unit_test: 18, monthly: 22, midterm: 28, final: 32, mock: 25, olympiad: 12 }
  const count = countMap[purpose] || 10

  // 3. 年级 → 难度
  let difficulty = 'L2'
  if (grade <= 2) difficulty = 'L1'
  else if (grade <= 4) difficulty = 'L2'
  else if (grade <= 6) difficulty = 'L3'
  else difficulty = 'L3'
  // 苏教版偏难
  if (textbook_math === '苏教版') {
    difficulty = grade <= 4 ? 'L2' : 'L3'
  }

  // 4. 学科 → 题型
  const typesBySubject: Record<string, string[]> = {
    '语文': ['choice', 'fill', 'reading', 'writing'],
    '数学': ['choice', 'fill', 'calculation', 'essay'],
    '英语': ['choice', 'cloze', 'reading', 'match'],
  }
  const defaultTypes = typesBySubject[subject] || ['choice', 'fill', 'calculation']

  return { purpose, count, difficulty, defaultTypes, semester }
}

// ── 区域→教材映射 ──

export const PROVINCE_TO_TEXTBOOK_MATH: Record<string, string> = {
  '河北': '人教版', '河南': '人教版', '山西': '人教版', '内蒙古': '人教版',
  '北京': '北师大版', '天津': '北师大版',
  '湖北': '人教版', '湖南': '人教版', '江西': '人教版',
  '广西': '人教版', '海南': '人教版', '贵州': '人教版', '云南': '人教版',
  '广东': '北师大版', '福建': '北师大版',
  '江苏': '苏教版',
  '上海': '沪教版',
  '山东': '青岛版',
  '四川': '西师大版', '重庆': '西师大版',
  '陕西': '人教版', '甘肃': '人教版', '宁夏': '人教版', '青海': '人教版', '新疆': '人教版',
  '黑龙江': '人教版', '吉林': '人教版', '辽宁': '人教版',
  '安徽': '北师大版',
  '浙江': '人教版',
  '西藏': '人教版',
}

export const ALL_MATH_TEXTBOOKS = ['人教版', '北师大版', '苏教版', '沪教版', '冀教版', '青岛版', '西师大版']
export const ALL_ENGLISH_TEXTBOOKS = ['PEP', '外研版', '牛津版', '冀教版']
