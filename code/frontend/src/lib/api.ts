/** 知微AI教学助手 — 前端API工具类 */

const API_BASE = import.meta.env.VITE_API_URL || '/api'

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
  // 内存与存储同步：外部注入 localStorage 的 token 也立即生效（避免内存/存储不一致的 401 死循环）
  if (!token) token = localStorage.getItem('zhiwei_token') || null
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
  // Token 不足时触发全局弹窗
  if (res.status === 429 || res.status === 402) {
    window.dispatchEvent(new CustomEvent('token-insufficient', { detail: await res.json().catch(() => ({})) }))
    throw new Error('Token 不足，请充值')
  }

  const body = await res.text()

  // 安全解析 JSON — 防止服务器返回 HTML 错误页面时崩溃
  let data: any
  try {
    data = body ? JSON.parse(body) : {}
  } catch (parseErr) {
    // 服务器返回了 HTML（通常是 404/500 错误页面）
    if (body.trim().startsWith('<')) {
      throw new Error(`服务器返回了 HTML 错误页面 (HTTP ${res.status})，请检查后端服务是否正常运行`)
    }
    throw new Error(`服务器响应格式错误: ${parseErr}`)
  }

  if (!res.ok) {
    throw new Error(data.message || data.error || `请求失败 (HTTP ${res.status})`)
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

  /** 知微云登录（统一登录 P1）：用 cloud 邮箱+密码验证并绑定 school 账号。
   *  不经过全局 request（避免 401 被当作"登录已过期"跳转）。 */
  cloudLogin: async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/cloud/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'same-origin',
    })
    const body = await res.text()
    let data: any
    try { data = body ? JSON.parse(body) : {} } catch { throw new Error('服务器响应格式错误') }
    if (!res.ok) {
      throw new Error(data.message || data.error || `云登录失败 (HTTP ${res.status})`)
    }
    return data
  },
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
  /** 当前教师本人任教的「班级-学科」列表（支持一课多班、一班多学科） */
  myClasses: () => request<{ items: Array<{ class_id: string; class_name: string; grade: string; subject: string; is_primary: boolean }> }>('/my-classes'),
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
    school_id?: string
    textbook_version?: string
    extra_requirements?: string
    chat_context?: string
  }) =>
    request<any>('/ai/lesson-plan/generate', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  /** 课件生成（锚点—轨道—边缘 三层，允许受控发散） */
  generateCourseware: (params: {
    subject: string
    grade: string
    lesson_title: string
    content?: string
    school_id?: string
    textbook_version?: string
    extra_requirements?: string
    chat_context?: string
    selected_knowledge_ids?: string[]
    knowledge_points?: string[]
    prerequisite_points?: string[]
    curriculum_codes?: string[]
    divergence_level?: 'conservative' | 'standard' | 'expansive'
    consult_answers?: string
    edge_enabled?: boolean
    edge_categories?: string[]
  }) =>
    request<any>('/ai/courseware/generate', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  /** 课前问诊：返回针对性问题，教师逐项作答后回传 */
  consultCourseware: (params: {
    subject: string
    grade: string
    lesson_title: string
    knowledge_points?: string[]
  }) =>
    request<any>('/ai/courseware/consult', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  /** 发布校验（平台红线锁）：对课件 Markdown 校验，指出问题并提醒修改 */
  validateCourseware: (params: {
    markdown: string
    subject: string
    grade: string
  }) =>
    request<any>('/ai/courseware/validate', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  /** 剔除指定的发散内容并刷新发散地图（D 组：教师逐项勾选删除） */
  trimCourseware: (params: {
    markdown: string
    remove_items: Array<{ content: string; anchor?: string; zone?: string }>
  }) =>
    request<any>('/ai/courseware/trim', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  /** PPT 课件渲染（AI 渲染 + 预置模板）：把课件 Markdown 渲染为结构化幻灯片 */
  renderPptCourseware: (params: {
    markdown: string
    title: string
    subject: string
    grade: string
  }) =>
    request<any>('/ai/courseware/render-ppt', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  /** 出题 / 智能组卷（共用端点，返回结构化 JSON） */
  generateExam: (params: Record<string, any>) =>
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

// ── 素材/课件接口 ──

export const materialAPI = {
  list: () => request<any>('/materials'),
  /** 以 JSON 方式创建素材（保存 AI 生成的课件） */
  createJSON: (data: { name: string; type: string; tag?: string; url?: string; content?: string }) =>
    request<any>('/materials/json', { method: 'POST', body: JSON.stringify(data) }),
  get: (id: string) => request<any>(`/materials/${id}`),
}

// ── 学生端接口 ──

export const studentAPI = {
  listAssignments: () => request<any>('/student/assignments'),
  getGradingDetail: (id: string) => request<any>(`/student/grading/${id}`),
  getErrorBook: () => request<any>('/student/error-book'),
}

// ── 家长端接口 ──

export const parentAPI = {
  getSignature: (id: string) => request<any>(`/parent/signatures/${id}`),
  sign: (id: string, signatureImgUrl: string) =>
    request<any>(`/parent-signatures/${id}/sign`, {
      method: 'POST',
      body: JSON.stringify({ signature_img_url: signatureImgUrl }),
    }),
}

// ── 学校配置接口 ──

export const schoolConfigAPI = {
  /** 教师申请开启知识图谱 */
  featureRequest: (feature: string) =>
    request<any>('/schools/feature-request', {
      method: 'POST',
      body: JSON.stringify({ feature }),
    }),
}

// ── Token 配额接口 ──

export const tokenQuotaAPI = {
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
  /**
   * 保存题目到个人题库。
   * 后端真实端点为 /exercises（POST=CreateQuestion），接收单题 flat 结构：
   * { stem, question_type, answer, analysis, subject, grade, difficulty, source }。
   * 前端传的是 {questions:[...]} 数组，故此处逐题 POST 并聚合返回 {question_ids, count}。
   */
  save: async (data: {
    questions: { type: string; content: string; difficulty?: string; options?: string; answer?: string; answer_detail?: string; knowledge_points?: string[] }[]
    subject: string; grade: string; semester?: string; textbook_version?: string; chapter_unit?: string
    source?: string; source_prompt?: string
  }) => {
    const ids: string[] = []
    for (const q of (data.questions || [])) {
      try {
        const r = await request<any>('/exercises', {
          method: 'POST',
          body: JSON.stringify({
            stem: q.content || q.stem || q.question || '',
            question_type: q.type,
            answer: q.answer || '',
            analysis: q.answer_detail || '',
            subject: data.subject,
            grade: data.grade,
            difficulty: q.difficulty || 'L2',
            source: data.source || 'ai_generated',
          }),
        })
        if (r && r.id) ids.push(r.id)
      } catch {
        // 单题失败不阻断其余题目保存
      }
    }
    return { question_ids: ids, count: ids.length }
  },

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
    questions?: string; question_ids?: string[]; content?: string; tier?: string; estimated_duration?: number; difficulty_level?: string; knowledge_node_ids?: string
  }) =>
    request<any>('/assignments', { method: 'POST', body: JSON.stringify(data) }),
}

export const api = request

// ── 数据初始化批量导入接口 ──

async function uploadFile(path: string, file: File): Promise<any> {
  const fd = new FormData()
  fd.append('file', file)
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    body: fd,
    headers,
    credentials: 'same-origin',
  })
  if (res.status === 401) {
    clearToken()
    window.location.href = '/login'
    throw new Error('登录已过期')
  }
  const body = await res.text()
  let data: any
  try {
    data = body ? JSON.parse(body) : {}
  } catch {
    throw new Error('服务器响应格式错误')
  }
  if (!res.ok) {
    throw new Error(data.message || data.error || `请求失败 (HTTP ${res.status})`)
  }
  return data
}

export const importAPI = {
  /** 预校验（dry-run） */
  preview: (type: string, file: File) => uploadFile(`/admin/import/${type}?dry_run=1`, file),
  /** 正式执行导入 */
  commit: (type: string, file: File) => uploadFile(`/admin/import/${type}`, file),
  /** 导入历史 */
  history: () => request<any>('/admin/import/history'),
  /** 按批次回滚 */
  rollback: (batchId: string) => request<any>(`/admin/import/rollback/${batchId}`, { method: 'POST' }),
}

// ── IT 管理后台：角色 / 教材版本 / 学期（P1）──
export const adminAPI = {
  /** 用户列表（角色管理） */
  listUsers: () => request<any>('/admin/users'),
  /** 单用户改角色 */
  updateUserRole: (id: string, role: string) =>
    request<any>(`/admin/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
  /** 教材版本列表（平台默认 + 学校覆盖） */
  listTextbooks: () => request<any>('/admin/textbooks'),
  /** 批量 upsert 学校自用教材版本覆盖（仅本校生效，不影响公共库） */
  upsertTextbook: (rows: { subject: string; grade?: string; publisher: string; version_name: string }[]) =>
    request<any>('/admin/textbooks', { method: 'PUT', body: JSON.stringify({ rows }) }),
  /** 学期列表 */
  listSemesters: () => request<any>('/admin/semesters'),
  /** 创建学期 */
  createSemester: (data: { name: string; start_date: string; end_date: string }) =>
    request<any>('/admin/semesters', { method: 'POST', body: JSON.stringify(data) }),
  // ── V2.5 教材版本三级配置（学校级/年级学科级/班级级）──
  /** 列出本校所有教材配置 */
  listTextbookConfigs: () => request<any>('/admin/textbook-configs'),
  /** 新增/更新一条教材配置（upsert） */
  upsertTextbookConfig: (data: {
    config_type: 'school' | 'grade_subject' | 'class_subject';
    subject: string;
    grade?: string;
    class_id?: string;
    publisher: string;
    version_name: string;
  }) => request<any>('/admin/textbook-configs', { method: 'POST', body: JSON.stringify(data) }),
  /** 删除一条教材配置 */
  deleteTextbookConfig: (id: string) =>
    request<any>(`/admin/textbook-configs/${id}`, { method: 'DELETE' }),
  /** 解析某学科在某班级的实际教材版本（含来源层级） */
  resolveTextbookConfig: (params: { subject: string; grade?: string; class_id?: string }) =>
    request<any>(`/admin/textbook-configs/resolve?subject=${encodeURIComponent(params.subject)}&grade=${encodeURIComponent(params.grade || '')}&class_id=${encodeURIComponent(params.class_id || '')}`),
  // ── V2.6 全学科教材版本库维护（IT 管理员，数据团队数据导入/维护）──
  /** 原始版本库列表（含 id / version_key） */
  listTextbookLibrary: () => request<any>('/admin/textbook-versions'),
  /** 新增一条版本库记录 */
  createTextbookVersion: (v: any) => request<any>('/admin/textbook-versions', { method: 'POST', body: JSON.stringify(v) }),
  /** 更新一条版本库记录 */
  updateTextbookVersion: (id: number | string, v: any) =>
    request<any>(`/admin/textbook-versions/${id}`, { method: 'PUT', body: JSON.stringify(v) }),
  /** 删除一条版本库记录 */
  deleteTextbookVersion: (id: number | string) =>
    request<any>(`/admin/textbook-versions/${id}`, { method: 'DELETE' }),
  /** 批量导入版本库（数据团队交付 JSON 数组） */
  importTextbookVersions: (rows: any[]) =>
    request<any>('/admin/textbook-versions/import', { method: 'POST', body: JSON.stringify({ rows }) }),
  /** V2.6 用户贡献版本审核 */
  listPendingSubmittedVersions: () => request<any>('/admin/textbook-versions/pending'),
  approveSubmittedVersion: (id: number) =>
    request<any>(`/admin/textbook-versions/pending/${id}/approve`, { method: 'PUT' }),
  rejectSubmittedVersion: (id: number, reason: string) =>
    request<any>(`/admin/textbook-versions/pending/${id}/reject`, { method: 'PUT', body: JSON.stringify({ reason }) }),
}

// ── V2.5/2.6 个人教材偏好（per-user，跨设备同步，规格书 §5.1）──
export const teacherPrefAPI = {
  /** 列出当前教师全部个人教材偏好 */
  list: () => request<any>('/me/textbook-prefs'),
  /** 新增/更新一条个人教材偏好（按 teacher_id+grade+class_id+subject upsert） */
  upsert: (data: { subject: string; grade?: string; class_id?: string; publisher: string; version_name: string }) =>
    request<any>('/me/textbook-prefs', { method: 'POST', body: JSON.stringify(data) }),
  /** 删除一条个人教材偏好 */
  remove: (subject: string, grade?: string, classID?: string) =>
    request<any>(`/me/textbook-prefs?subject=${encodeURIComponent(subject)}&grade=${encodeURIComponent(grade || '')}&class_id=${encodeURIComponent(classID || '')}`, { method: 'DELETE' }),
  /** 解析当前 学科/年级/班级 的有效教材版本（个人偏好 > 学校配置 > 平台库） */
  effective: (params: { subject: string; grade?: string; class_id?: string }) =>
    request<any>(`/me/textbook-effective?subject=${encodeURIComponent(params.subject)}&grade=${encodeURIComponent(params.grade || '')}&class_id=${encodeURIComponent(params.class_id || '')}`),
  /** V2.6 用户提交教材版本贡献 */
  submitTextbookVersion: (data: {
    xue_ke: string; jiao_cai_ming: string; chu_ban_she: string;
    ban_ben_biao_shi: string; nian_ji?: string; xue_duan?: string; ce_bie?: string;
  }) => request<any>('/me/submit-textbook-version', { method: 'POST', body: JSON.stringify(data) }),
}

export default { authAPI, schoolAPI, schoolConfigAPI, classAPI, aiAPI, lessonPlanAPI, materialAPI, studentAPI, parentAPI, tokenQuotaAPI, questionBankAPI, assignmentAPI, importAPI, adminAPI, teacherPrefAPI }
