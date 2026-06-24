/** 知微AI教学助手 — 前端API工具类 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1'

// 存储Token
let token: string | null = localStorage.getItem('zhiwei_token') || null

export const setToken = (t: string) => {
  token = t
  localStorage.setItem('zhiwei_token', t)
}

export const getToken = () => token

export const clearToken = () => {
  token = null
  localStorage.removeItem('zhiwei_token')
}

// CSRF Token 管理
function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/)
  return match ? match[1] : ''
}

// 统一请求
async function request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  // CSRF Token（写操作时发送）
  const method = (options.method || 'GET').toUpperCase()
  if (['POST','PUT','PATCH','DELETE'].includes(method)) {
    const csrf = getCsrfToken()
    if (csrf) headers['X-CSRF-Token'] = csrf
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'same-origin',
  })

  if (res.status === 401) {
    clearToken()
    window.location.href = '/login'
    throw new Error('登录已过期')
  }

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.message || '请求失败')
  }
  return data
}

// ── 认证接口 ──

export const authAPI = {
  /** 密码登录（SaaS=phone，私有部署=username） */
  login: (phone: string, password: string, username?: string) =>
    request<any>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(username ? { username, password } : { phone, password }),
    }),

  /** 验证码登录 */
  codeLogin: (phone: string, code: string) =>
    request<any>('/auth/code-login', {
      method: 'POST',
      body: JSON.stringify({ phone, code }),
    }),

  /** 发送验证码 */
  sendCode: (phone: string) =>
    request<any>('/auth/send-code', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),

  /** 注册 */
  register: (phone: string, password: string, name: string, role: string) =>
    request<any>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ phone, password, name, role }),
    }),

  /** 获取当前用户信息 */
  me: () => request<any>('/auth/me'),
}

// ── 学校接口 ──

export const schoolAPI = {
  list: () => request<any>('/schools'),
  create: (name: string, region: string, contact: string, phone: string) =>
    request<any>('/schools', {
      method: 'POST',
      body: JSON.stringify({ name, region, contact, phone }),
    }),
}

// ── 班级接口 ──

export const classAPI = {
  list: () => request<any>('/classes'),
  create: (name: string, grade: string) =>
    request<any>('/classes', {
      method: 'POST',
      body: JSON.stringify({ name, grade }),
    }),
}

// ── 工作台接口 ──

export const dashboardAPI = {
  home: () => request<any>('/dashboard/home'),
}

// ── AI 接口 ──

export const aiAPI = {
  /** 教案生成 */
  generateLessonPlan: (params: {
    subject: string
    grade: string
    lesson_title: string
    textbook_unit?: string
    period?: number
    format_template?: string
    selected_knowledge_ids?: string[]
  }) =>
    request<any>('/ai/lesson-plan/generate', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  /** 出题 */
  generateExam: (params: {
    subject: string
    knowledge_point: string
    grade: string
    difficulty?: string
    count?: number
  }) =>
    request<any>('/ai/exam/generate', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  /** 自动批阅 */
  autoGrading: (params: { answers: any[]; assignment_id: string; student_id: string }) =>
    request<any>('/ai/grading/auto', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  /** 小微AI助手对话 */
  chat: (params: { message: string; context: { teacher_name: string; subject: string; grade: string } }) =>
    request<any>('/ai/chat', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
}

// ── 教案接口 ──

export const lessonPlanAPI = {
  list: () => request<any>('/lesson-plans'),
  create: (data: any) =>
    request<any>('/lesson-plans', { method: 'POST', body: JSON.stringify(data) }),
  get: (id: string) => request<any>(`/lesson-plans/${id}`),
  update: (id: string, data: any) =>
    request<any>(`/lesson-plans/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  finalize: (id: string) =>
    request<any>(`/lesson-plans/${id}/finalize`, { method: 'POST' }),
  delete: (id: string) =>
    request<any>(`/lesson-plans/${id}`, { method: 'DELETE' }),
}

// ── 学生端接口 ──

export const studentAPI = {
  listAssignments: () => request<any>('/student/assignments'),
  getGradingDetail: (id: string) => request<any>(`/student/grading/${id}`),
  getErrorBook: () => request<any>('/student/error-book'),
}

// ── 家长端接口 ──

export const parentAPI = {
  listAssignments: () => request<any>('/parent/assignments'),
  getSignature: (id: string) => request<any>(`/parent/signatures/${id}`),
  sign: (id: string, signatureImgUrl: string) =>
    request<any>(`/parent-signatures/${id}/sign`, {
      method: 'POST',
      body: JSON.stringify({ signature_img_url: signatureImgUrl }),
    }),
}

// ── 学校配置接口 ──

export const schoolConfigAPI = {
  /** 获取学校配置（含 knowledge_graph 开关） */
  fetch: () => request<any>('/school/settings'),

  /** 教师申请开启知识图谱 */
  featureRequest: (feature: string) =>
    request<any>('/schools/feature-request', {
      method: 'POST',
      body: JSON.stringify({ feature }),
    }),
}

// ── Token 配额接口 ──

export const tokenQuotaAPI = {
  /** 获取我的配额消耗 */
  myQuota: () => request<any>('/token/my-quota'),

  /** 获取学校教师列表（含配额，管理员用） */
  listTeachers: () => request<any>('/admin/teachers'),

  /** 批量更新教师配额 */
  batchUpdateQuota: (teacherIDs: string[], quota: number, custom: boolean) =>
    request<any>('/admin/teachers/quota', {
      method: 'PUT',
      body: JSON.stringify({ teacher_ids: teacherIDs, quota, custom }),
    }),
}

// ── 题库接口 ──

export const questionBankAPI = {
  /** 保存题目到个人题库 */
  save: (data: {
    questions: { type: string; content: string; difficulty: string; options?: string; answer?: string; answer_detail?: string; knowledge_points?: string[] }[]
    subject: string; grade: string; semester: string; textbook_version: string; chapter_unit: string
    source: string; source_prompt: string
  }) =>
    request<any>('/questions', { method: 'POST', body: JSON.stringify(data) }),

  /** 个人题库列表 */
  listPersonal: (params: { subject?: string; grade?: string; type?: string; difficulty?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, String(v)) })
    return request<any>(`/questions/personal?${qs}`)
  },

  /** 校本题库列表 */
  listSchool: (params: { subject?: string; grade?: string; type?: string; difficulty?: string; min_rating?: number; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, String(v)) })
    return request<any>(`/questions/school?${qs}`)
  },

  /** 搜索题目 */
  search: (keyword: string, scope: 'all' | 'personal' = 'all') =>
    request<any>(`/questions/search?keyword=${encodeURIComponent(keyword)}&scope=${scope}`),

  /** 题目详情 */
  get: (id: string) => request<any>(`/questions/${id}`),

  /** 更新题目 */
  update: (id: string, data: any) =>
    request<any>(`/questions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  /** 删除题目 */
  delete: (id: string) =>
    request<any>(`/questions/${id}`, { method: 'DELETE' }),

  /** 贡献到校本题库 */
  contribute: (questionIDs: string[]) => {
    if (!questionIDs || questionIDs.length === 0) {
      throw new Error('请选择至少一道题目')
    }
    return request<any>(`/questions/${questionIDs[0]}/contribute`, {
      method: 'POST',
      body: JSON.stringify({ question_ids: questionIDs }),
    })
  },

  /** 评分 */
  rate: (questionId: string, data: { score: number; tags?: string[]; comment?: string; assignment_id: string }) =>
    request<any>(`/questions/${questionId}/rate`, { method: 'POST', body: JSON.stringify(data) }),

  /** 查重 */
  checkDuplicate: (classId: string, questionIds: string[]) =>
    request<any>(`/questions/check-duplicate?class_id=${classId}`, {
      method: 'POST',
      body: JSON.stringify({ question_ids: questionIds }),
    }),

  /** 题库统计 */
  stats: () => request<any>('/questions/stats'),

  /** 待审核列表（教研组长） */
  pendingAudits: () => request<any>('/questions/audits/pending'),

  /** 审核 */
  audit: (id: string, approved: boolean) =>
    request<any>(`/questions/${id}/audit`, { method: 'POST', body: JSON.stringify({ approved }) }),
}

// ── 作业接口 ──

export const assignmentAPI = {
  /** 作业列表 */
  list: () => request<any>('/assignments'),

  /** 创建作业（支持旧版 questions JSONB 或新版 question_ids） */
  create: (data: {
    class_id: string; subject: string; title: string; type: string
    questions?: string; question_ids?: string[]; difficulty_level?: string; knowledge_node_ids?: string
  }) =>
    request<any>('/assignments', { method: 'POST', body: JSON.stringify(data) }),
}

export default { authAPI, schoolAPI, schoolConfigAPI, classAPI, dashboardAPI, aiAPI, lessonPlanAPI, studentAPI, parentAPI, tokenQuotaAPI, questionBankAPI, assignmentAPI }
