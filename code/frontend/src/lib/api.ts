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

export default { authAPI, schoolAPI, schoolConfigAPI, classAPI, dashboardAPI, aiAPI, lessonPlanAPI, studentAPI, parentAPI, tokenQuotaAPI }
