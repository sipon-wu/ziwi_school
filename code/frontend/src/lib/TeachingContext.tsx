import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'

// ── 类型定义 ──

/** 课程组 = 年级 + 学科 + 教材版本（共享数据的原子粒度） */
export interface CourseGroup {
  id: string              // 如 'grade4-chinese-pep'
  label: string           // 显示名，如 '四年级·语文'
  grade: number
  subject: '语文' | '数学' | '英语'
  textbook: string        // 教材版本，如 '部编版（统编版）'
  classCount: number      // 该课程组下辖班级数
  classLabels: string     // 班级列表简述，如 '四1、四2'
}

/** 班级（保持兼容，执行层使用） */
export interface ClassInfo {
  id: string
  label: string
  courseGroupId: string   // 所属课程组
  subject: '语文' | '数学' | '英语'
  grade: number
  semester: '上' | '下'
  textbook: string
}

export interface TeachingState {
  subject: '语文' | '数学' | '英语'
  grade: number
  semester: '上' | '下'
  textbook_math: string
  textbook_english: string
  textbook_locked: boolean
  current_unit_name: string
  current_lesson_name: string
  progress_percent: number
  knowledgeGraphEnabled: boolean
  /** v2.0: 当前选中课程组 ID（null = 工作台概览） */
  selectedCourseGroupId: string | null
  /** v2.0: 当前选中班级 ID（执行层，仅在批阅/学情/家校页面体现） */
  selectedClassId: string | null
}

const DEFAULT_STATE: TeachingState = {
  subject: '语文',
  grade: 4,
  semester: '下',
  textbook_math: '人教版',
  textbook_english: 'PEP',
  textbook_locked: true,
  current_unit_name: '第三单元: 运算定律',
  current_lesson_name: '第2课时: 乘法分配律',
  progress_percent: 37,
  knowledgeGraphEnabled: true,
  selectedCourseGroupId: null,
  selectedClassId: null,
}

const STORAGE_KEY = 'zhiwei_teaching'
function loadState(): TeachingState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      // 只允许合法 JSON 对象，排除 null/true/false/数字/字符串等非对象值
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { ...DEFAULT_STATE, ...parsed }
      }
      // 格式不对 → 清除脏数据
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // 解析失败 → 清除脏数据
    localStorage.removeItem(STORAGE_KEY)
  }
  return DEFAULT_STATE
}
function saveState(s: TeachingState) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) }

// ── Context ──

interface TeachingCtxValue extends TeachingState {
  setSubject: (s: TeachingState['subject']) => void
  setGrade: (g: number) => void
  setSemester: (s: TeachingState['semester']) => void
  setTextbookMath: (v: string) => void
  setTextbookEnglish: (v: string) => void
  setKnowledgeGraphEnabled: (v: boolean) => void
  setProgress: (unit: string, lesson: string, pct: number) => void
  /** v2.0: 选中课程组（入口级锚点） */
  selectCourseGroup: (cg: CourseGroup) => void
  /** v2.0: 退出课程组，回到工作台 */
  clearCourseGroup: () => void
  /** v2.0: 在执行层选中一个班级（批阅/学情/家校页面用） */
  selectClass: (c: ClassInfo) => void
  /** 清除班级选中 */
  clearClass: () => void
  reset: () => void
}

const TeachingCtx = createContext<TeachingCtxValue | null>(null)

export function TeachingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TeachingState>(loadState)
  useEffect(() => { saveState(state) }, [state])

  const setSubject = useCallback((s: TeachingState['subject']) => setState(p => ({ ...p, subject: s })), [])
  const setGrade = useCallback((g: number) => setState(p => ({ ...p, grade: g })), [])
  const setSemester = useCallback((s: TeachingState['semester']) => setState(p => ({ ...p, semester: s })), [])
  const setTextbookMath = useCallback((v: string) => setState(p => ({ ...p, textbook_math: v })), [])
  const setTextbookEnglish = useCallback((v: string) => setState(p => ({ ...p, textbook_english: v })), [])
  const setKnowledgeGraphEnabled = useCallback((v: boolean) => setState(p => ({ ...p, knowledgeGraphEnabled: v })), [])
  const setProgress = useCallback((u: string, l: string, pct: number) =>
    setState(p => ({ ...p, current_unit_name: u, current_lesson_name: l, progress_percent: pct })), [])

  /** 选中课程组：原子设置 subject/grade/textbook */
  const selectCourseGroup = useCallback((cg: CourseGroup) => {
    setState(prev => ({
      ...prev,
      subject: cg.subject,
      grade: cg.grade,
      textbook_math: cg.subject === '数学' ? cg.textbook : prev.textbook_math,
      textbook_english: cg.subject === '英语' ? cg.textbook : prev.textbook_english,
      selectedCourseGroupId: cg.id,
      // 自动选中该课程组第一个班级
      selectedClassId: null,
    }))
  }, [])

  const clearCourseGroup = useCallback(() => {
    setState(prev => ({ ...prev, selectedCourseGroupId: null, selectedClassId: null }))
  }, [])

  const selectClass = useCallback((c: ClassInfo) => {
    setState(prev => ({
      ...prev,
      selectedClassId: c.id,
      // 如果选中的班级属于另一个课程组，同步切换课程组
      ...(c.courseGroupId !== prev.selectedCourseGroupId
        ? { selectedCourseGroupId: c.courseGroupId, subject: c.subject, grade: c.grade }
        : {}),
    }))
  }, [])

  const clearClass = useCallback(() => setState(p => ({ ...p, selectedClassId: null })), [])
  const reset = useCallback(() => setState(DEFAULT_STATE), [])

  return (
    <TeachingCtx.Provider value={{
      ...state, setSubject, setGrade, setSemester, setTextbookMath, setTextbookEnglish,
      setKnowledgeGraphEnabled, setProgress, selectCourseGroup, clearCourseGroup,
      selectClass, clearClass, reset,
    }}>
      {children}
    </TeachingCtx.Provider>
  )
}

export function useTeaching(): TeachingCtxValue {
  const ctx = useContext(TeachingCtx)
  if (!ctx) throw new Error('useTeaching must be used within TeachingProvider')
  return ctx
}

// ── 演示用模拟课程组 ──

export const MOCK_COURSE_GROUPS: CourseGroup[] = [
  { id: 'g4-chinese-pep',  label: '四年级·语文', grade: 4, subject: '语文', textbook: '部编版（统编版）', classCount: 2, classLabels: '四1、四2' },
  { id: 'g4-chinese-js',   label: '四年级·语文', grade: 4, subject: '语文', textbook: '苏教版',         classCount: 1, classLabels: '四3' },
  { id: 'g3-math-renjiao', label: '三年级·数学', grade: 3, subject: '数学', textbook: '人教版',         classCount: 1, classLabels: '三2' },
  { id: 'g6-chinese-pep',  label: '六年级·语文', grade: 6, subject: '语文', textbook: '部编版（统编版）', classCount: 1, classLabels: '六1' },
  { id: 'g5-english-pep',  label: '五年级·英语', grade: 5, subject: '英语', textbook: 'PEP（三年级起）', classCount: 1, classLabels: '五1' },
]

// ── 演示用模拟班级（关联课程组）──

export const MOCK_CLASSES: ClassInfo[] = [
  { id: '4-1-chinese', label: '四1班 · 语文', courseGroupId: 'g4-chinese-pep', subject: '语文', grade: 4, semester: '下', textbook: '部编版（统编版）' },
  { id: '4-2-chinese', label: '四2班 · 语文', courseGroupId: 'g4-chinese-pep', subject: '语文', grade: 4, semester: '下', textbook: '部编版（统编版）' },
  { id: '4-3-chinese', label: '四3班 · 语文', courseGroupId: 'g4-chinese-js',  subject: '语文', grade: 4, semester: '下', textbook: '苏教版' },
  { id: '3-2-math',    label: '三2班 · 数学', courseGroupId: 'g3-math-renjiao',subject: '数学', grade: 3, semester: '下', textbook: '人教版' },
  { id: '6-1-chinese', label: '六1班 · 语文', courseGroupId: 'g6-chinese-pep', subject: '语文', grade: 6, semester: '下', textbook: '部编版（统编版）' },
  { id: '5-1-english', label: '五1班 · 英语', courseGroupId: 'g5-english-pep', subject: '英语', grade: 5, semester: '下', textbook: 'PEP（三年级起）' },
]

// ── 某年级+学科下的所有教材版本（从课程组中动态获取）──
export function getTextbookVersions(grade: number, subject: string): string[] {
  return MOCK_COURSE_GROUPS
    .filter(cg => cg.grade === grade && cg.subject === subject)
    .map(cg => cg.textbook)
}

// ── 角色名称映射 ──
export const ROLE_LABELS: Record<string, string> = {
  teacher: '教师', principal: '校长', director: '教务主任', it_admin: 'IT管理员',
}

// ── AI 推荐服务（保持不变）──

export function getRecommendedDefaults(teaching: TeachingState) {
  const { subject, grade, semester, textbook_math } = teaching
  const day = new Date().getDay()
  const date = new Date().getDate()
  let purpose: string
  if (date > 25) purpose = 'monthly'
  else if (day === 4 || day === 5) purpose = 'homework'
  else purpose = 'classwork'
  const countMap: Record<string, number> = { classwork: 5, homework: 8, unit_test: 18, monthly: 22, midterm: 28, final: 32, mock: 25, olympiad: 12 }
  const count = countMap[purpose] || 10
  let difficulty = 'L2'
  if (grade <= 2) difficulty = 'L1'; else if (grade <= 4) difficulty = 'L2'; else if (grade <= 6) difficulty = 'L3'; else difficulty = 'L3'
  if (textbook_math === '苏教版') difficulty = grade <= 4 ? 'L2' : 'L3'
  const typesBySubject: Record<string, string[]> = { '语文': ['choice','fill','reading','writing'], '数学': ['choice','fill','calculation','essay'], '英语': ['choice','cloze','reading','match'] }
  return { purpose, count, difficulty, defaultTypes: typesBySubject[subject] || ['choice','fill','calculation'], semester }
}

export const PROVINCE_TO_TEXTBOOK_MATH: Record<string, string> = {
  '河北': '人教版','河南': '人教版','山西': '人教版','内蒙古': '人教版','北京': '北师大版','天津': '北师大版',
  '湖北': '人教版','湖南': '人教版','江西': '人教版','广西': '人教版','海南': '人教版','贵州': '人教版','云南': '人教版',
  '广东': '北师大版','福建': '北师大版','江苏': '苏教版','上海': '沪教版','山东': '青岛版',
  '四川': '西师大版','重庆': '西师大版','陕西': '人教版','甘肃': '人教版','宁夏': '人教版','青海': '人教版','新疆': '人教版',
  '黑龙江': '人教版','吉林': '人教版','辽宁': '人教版','安徽': '北师大版','浙江': '人教版','西藏': '人教版',
}
export const ALL_CHINESE_TEXTBOOKS = ['部编版（统编版）', '人教版（旧版）', '苏教版', '北师大版', '沪教版（五四制）']
export const ALL_MATH_TEXTBOOKS = ['人教版','北师大版','苏教版','沪教版','冀教版','青岛版（六三制）','青岛版（五四制）','西师大版','浙教版','北京版','鲁教版','华师大版','湘教版','沪科版','京教版']
export const ALL_ENGLISH_TEXTBOOKS = ['PEP（三年级起）','PEP（一年级起）','外研版（三起）','外研版（一起）','译林版（牛津）','牛津上海版','沪教版','冀教版','湘少版','闽教版','鲁科版','教科版（EEC）','北师大版','清华版']
