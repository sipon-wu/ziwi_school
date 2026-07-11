import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { teacherPrefAPI } from './api'

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

// ── 题型定义（按学科区分，避免语文出现"计算题"等不适配题型） ──

export interface QuestionType {
  id: string
  label: string
}

/**
 * 各学科可选题型。依据语文/数学/英语常规试卷结构：
 * - 语文：字词句积累 + 阅读 + 习作，无计算/应用
 * - 数学：选择/填空/计算/应用/判断 + 操作作图
 * - 英语：选择/填空/完形/阅读/写作 + 听力/词汇
 */
export const QUESTION_TYPES_BY_SUBJECT: Record<string, QuestionType[]> = {
  语文: [
    { id: 'choice', label: '选择题' },
    { id: 'fill', label: '填空题' },
    { id: 'judge', label: '判断题' },
    { id: 'match', label: '匹配题' },
    { id: 'cloze', label: '完形填空' },
    { id: 'reading', label: '阅读理解' },
    { id: 'writing', label: '写作题' },
  ],
  数学: [
    { id: 'choice', label: '选择题' },
    { id: 'fill', label: '填空题' },
    { id: 'calculation', label: '计算题' },
    { id: 'application', label: '应用题' },
    { id: 'judge', label: '判断题' },
    { id: 'operation', label: '操作题' },
  ],
  英语: [
    { id: 'choice', label: '选择题' },
    { id: 'fill', label: '填空题' },
    { id: 'cloze', label: '完形填空' },
    { id: 'reading', label: '阅读理解' },
    { id: 'writing', label: '写作题' },
    { id: 'listening', label: '听力题' },
    { id: 'vocab', label: '词汇运用' },
  ],
}

/** 未知学科兜底（通用基础题型） */
const DEFAULT_QTYPES: QuestionType[] = [
  { id: 'choice', label: '选择题' },
  { id: 'fill', label: '填空题' },
  { id: 'judge', label: '判断题' },
]

/** 取得某学科的可选题型 */
export function getQuestionTypes(subject: string): QuestionType[] {
  return QUESTION_TYPES_BY_SUBJECT[subject] || DEFAULT_QTYPES
}

/** 题型 id → 中文名（用于渲染题目角标，覆盖所有已知题型） */
export const QUESTION_TYPE_LABELS: Record<string, string> = {
  choice: '选择题',
  fill: '填空题',
  judge: '判断题',
  truefalse: '判断题',
  short_answer: '简答题',
  match: '匹配题',
  cloze: '完形填空',
  reading: '阅读理解',
  writing: '写作题',
  calculation: '计算题',
  application: '应用题',
  operation: '操作题',
  listening: '听力题',
  vocab: '词汇运用',
}

/** 返回某学科是否允许该题型（用于净化 AI 返回结果，防止跨学科串题） */
export function isTypeAllowed(subject: string, type: string): boolean {
  return getQuestionTypes(subject).some((t) => t.id === type)
}

export interface TeachingState {
  subject: string
  grade: number
  semester: '上' | '下'
  textbook_math: string
  textbook_english: string
  /** 各学科的教材版本（学校级覆盖后的真实版本，按学科存储） */
  textbookBySubject: Record<string, string>
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

/** 各学科默认教材版本（无本地/学校偏好时的回退值） */
const DEFAULT_TEXTBOOK_BY_SUBJECT: Record<string, string> = {
  '语文': '部编版（统编版）',
  '数学': '人教版',
  '英语': 'PEP（三年级起）',
}

const DEFAULT_STATE: TeachingState = {
  subject: '语文',
  grade: 4,
  semester: '下',
  textbook_math: '人教版',
  textbook_english: 'PEP',
  textbookBySubject: {},
  textbook_locked: true,
  current_unit_name: '第三单元: 运算定律',
  current_lesson_name: '第2课时: 乘法分配律',
  progress_percent: 37,
  knowledgeGraphEnabled: true,
  selectedCourseGroupId: null,
  selectedClassId: null,
}

const STORAGE_PREFIX = 'zhiwei_teaching'
/** 学段中文 → 年级序号（四年级→4） */
export const GRADE_NAMES = ['一年级','二年级','三年级','四年级','五年级','六年级','七年级','八年级','九年级']
function gradeToNum(g?: string): number {
  if (!g) return 4
  const i = GRADE_NAMES.indexOf(g)
  return i >= 0 ? i + 1 : 4
}
/** 当前登录账号 ID（用于按账号隔离教学上下文） */
function currentUid(): string {
  try { return (JSON.parse(localStorage.getItem('user') || '{}').id) || '' } catch { return '' }
}
function storageKey(): string {
  const u = currentUid()
  return u ? `${STORAGE_PREFIX}_${u}` : STORAGE_PREFIX
}
function loadState(): TeachingState {
  try {
    const raw = localStorage.getItem(storageKey())
    if (raw) {
      // 只允许合法 JSON 对象，排除 null/true/false/数字/字符串等非对象值
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { ...DEFAULT_STATE, ...parsed }
      }
      localStorage.removeItem(storageKey())
    }
    // 无本地偏好时，回退到账号默认的学科/学段
    const u = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} } })()
    if (u && u.subject) {
      return { ...DEFAULT_STATE, subject: u.subject, grade: gradeToNum(u.grade) }
    }
  } catch {
    localStorage.removeItem(storageKey())
  }
  return DEFAULT_STATE
}
function saveState(s: TeachingState) { localStorage.setItem(storageKey(), JSON.stringify(s)) }

// ── Context ──

export interface TeachingCtxValue extends TeachingState {
  setSubject: (s: TeachingState['subject']) => void
  setGrade: (g: number) => void
  setSemester: (s: TeachingState['semester']) => void
  setTextbookMath: (v: string) => void
  setTextbookEnglish: (v: string) => void
  /** 按学科设置/读取教材版本（学校级覆盖后的真实版本） */
  setTextbook: (subject: string, version: string) => void
  currentTextbook: () => string
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
  /** V2.5 教材版本配置：学校 License 状态（active/trial/none），驱动教师端三种状态渲染 */
  licenseStatus: string
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
  const setTextbook = useCallback((subject: string, version: string) =>
    setState(p => ({ ...p, textbookBySubject: { ...p.textbookBySubject, [subject]: version } })), [])
  const currentTextbook = useCallback((): string => {
    const s = state.subject
    if (state.textbookBySubject[s]) return state.textbookBySubject[s]
    if (s === '数学') return state.textbook_math
    if (s === '英语') return state.textbook_english
    return DEFAULT_TEXTBOOK_BY_SUBJECT[s] || '人教版'
  }, [state.subject, state.textbookBySubject, state.textbook_math, state.textbook_english])
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

  // V2.6 教材版本配置：解析当前 学科/年级/班级 的有效版本（个人偏好 > 学校配置 > 平台库），
  // 写入 textbookBySubject。这样版本真正跟随 学科→年级→班级，而非只认学科。
  // 任意已登录用户均生效（个人试用走个人偏好，学校版走学校配置），未登录不请求以免 401 清空会话。
  useEffect(() => {
    const tk = (typeof localStorage !== 'undefined') ? localStorage.getItem('zhiwei_token') : null
    if (!tk) return
    const subject = state.subject
    const gradeName = GRADE_NAMES[state.grade - 1] || ''
    const classId = state.selectedClassId || ''
    teacherPrefAPI.effective({ subject, grade: gradeName, class_id: classId })
      .then((r: any) => {
        const v = r?.resolved?.version_name
        if (!v) return
        setState((prev) =>
          prev.textbookBySubject[subject] === v
            ? prev
            : ({ ...prev, textbookBySubject: { ...prev.textbookBySubject, [subject]: v } }))
      })
      .catch(() => {})
  // 学科/年级/选中班级变化时重新解析
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.subject, state.grade, state.selectedClassId])

  // V2.5 教材版本配置：学校 License 状态（active/trial/none），驱动教师端三种状态渲染。
  // 来源：登录时后端透传到 localStorage 的 user.license_status。
  const licenseStatus: string = (() => {
    try { return (JSON.parse(localStorage.getItem('user') || '{}').license_status as string) || 'none' } catch { return 'none' }
  })()

  return (
    <TeachingCtx.Provider value={{
      ...state, setSubject, setGrade, setSemester, setTextbookMath, setTextbookEnglish,
      setTextbook, currentTextbook, licenseStatus,
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
  const defaultTypes = getQuestionTypes(subject).slice(0, 3).map((t) => t.id)
  return { purpose, count, difficulty, defaultTypes, semester }
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
