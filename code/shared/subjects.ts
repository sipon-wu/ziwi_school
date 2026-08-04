// ── 学科事实源（全系统唯一） ──
// 教案 / 课件 / 出题 / 出卷 / 教材版本 / 班级学科配置 全部复用这一套，
// 以"知识边界"为准：仅考试计分文化课，不含艺体（音乐/美术/体育）与信息科技。
//
// 约定：系统内部学科以"中文名"为唯一标识（与 teaching.subject / 班级配置一致）；
// SUBJECT_CODES 提供中文→枚举 key 的反查（用于需要稳定 key 的场景，如教材版本库）。

export type SubjectCode =
  | 'chinese' | 'math' | 'english'
  | 'physics' | 'chemistry' | 'biology'
  | 'history' | 'geography' | 'politics'

// 枚举 key → 中文展示名（与 ITAdminPage.SUBJECTS_CN 一致）
export const SUBJECTS_CN: Record<string, string> = {
  chinese: '语文',
  math: '数学',
  english: '英语',
  physics: '物理',
  chemistry: '化学',
  biology: '生物',
  history: '历史',
  geography: '地理',
  politics: '政治',
}

// 中文名 → 枚举 key
export const SUBJECT_CODES: Record<string, SubjectCode> = Object.fromEntries(
  Object.entries(SUBJECTS_CN).map(([code, cn]) => [cn, code as SubjectCode]),
) as Record<string, SubjectCode>

// 全部边界学科（中文，按知识边界标准序）
export const ALL_SUBJECTS: string[] = Object.values(SUBJECTS_CN)

// 是否知识边界学科（用于收敛课件/教案/出题的学科范围）
export function isBoundarySubject(name: string): boolean {
  return name in SUBJECT_CODES
}

// 学段归属：小学仅主科+政治；中学才出现物理/化学/生物/历史/地理
// 用于"按学段给班级配学科"与模板骨架回落。
export type StageLevel = 'elementary' | 'middle' | 'high'

export const SUBJECTS_BY_LEVEL: Record<StageLevel, string[]> = {
  elementary: ['语文', '数学', '英语', '政治'],
  middle: ['语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理'],
  high: ['语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理'],
}

export function gradeLevelOf(grade: string | number): StageLevel {
  if (typeof grade === 'number') {
    if (grade >= 7 && grade <= 9) return 'middle'
    if (grade >= 10) return 'high'
    return 'elementary'
  }
  if (['七年级', '八年级', '九年级', '初一', '初二', '初三'].includes(grade)) return 'middle'
  if (['高一', '高二', '高三'].includes(grade)) return 'high'
  return 'elementary'
}

export function subjectsForGrade(grade: string | number): string[] {
  return SUBJECTS_BY_LEVEL[gradeLevelOf(grade)]
}
