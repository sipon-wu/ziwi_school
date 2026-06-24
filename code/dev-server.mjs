/**
 * 知微 AI 教学助手 - 本地开发 Mock 后端
 *
 * 用途：替代 Go 后端（需要 PostgreSQL/Redis），提供：
 *   1. 登录认证（固定账号）
 *   2. Dashboard 仪表盘 mock 数据
 *   3. AI API 代理到 Python AI 服务 (localhost:8000)
 *
 * 启动方式：node dev-server.mjs
 * 监听端口：8080（前端 vite proxy 指向这里）
 */
import http from 'http'

const AI_SERVICE = 'http://localhost:8000'
const PORT = 8080

const MOCK_DASHBOARD = {
  stats: { pending_grading: 12, pending_sign: 3, overdue_sign: 2, draft_plans: 5 },
  recent_plans: [
    { title: '《观潮》第一课时', subject: '四年级 · 语文', type: '录入教案', status: '已定稿', time: '2小时前' },
    { title: '《分数的初步认识》', subject: '三年级 · 数学', type: '复习课', status: '草稿', time: '昨天' },
    { title: 'Unit 3 My School Calendar', subject: '五年级 · 英语', type: "A Let's talk", status: '已定稿', time: '3天前' },
  ],
}

const MOCK_TOKEN_QUOTA = { used_monthly: 45000, quota_monthly: 200000, usage_pct: 22.5, level: 'normal' }

// 已保存题目列表（模拟题库）
let savedQuestions = []
let mockAssignments = []

const routes = {
  'POST /api/v1/auth/login': (req, res, body) => {
    const { phone, password, username } = body || {}
    // 演示账号
    if (phone === '13800000002' && password === 'teacher123') {
      return resJson(res, 200, { token: 'demo-token-teacher', user: { name: '张老师', role: 'teacher', work_mode: 'demo' } })
    }
    if (phone === '13800000001' && password === 'admin123') {
      return resJson(res, 200, { token: 'demo-token-admin', user: { name: '管理员', role: 'admin', work_mode: 'demo' } })
    }
    if (phone === '13800000003' && password === 'parent123') {
      return resJson(res, 200, { token: 'demo-token-parent', user: { name: '李家长', role: 'parent', work_mode: 'demo' } })
    }
    // 任意密码通过
    if (phone && password) {
      return resJson(res, 200, { token: 'demo-token', user: { name: '张老师', role: 'teacher', work_mode: 'demo' } })
    }
    if (username && password) {
      return resJson(res, 200, { token: 'demo-token', user: { name: username, role: 'teacher', work_mode: 'demo' } })
    }
    return resJson(res, 401, { message: '账号或密码错误' })
  },

  'GET /api/v1/auth/me': (_req, res) =>
    resJson(res, 200, { name: '张老师', role: 'teacher', work_mode: 'demo' }),

  'GET /api/v1/dashboard/home': (_req, res) =>
    resJson(res, 200, MOCK_DASHBOARD),

  'GET /api/v1/token/my-quota': (_req, res) =>
    resJson(res, 200, { data: MOCK_TOKEN_QUOTA }),

  'GET /api/v1/lesson-plans': (_req, res) =>
    resJson(res, 200, MOCK_DASHBOARD.recent_plans),

  'GET /api/v1/exercises': (_req, res) =>
    resJson(res, 200, { exercises: mockAssignments.length > 0 ? mockAssignments : [], total: mockAssignments.length }),

  'GET /api/v1/question-bank': (_req, res) =>
    resJson(res, 200, { questions: savedQuestions, total: savedQuestions.length }),

  // ── AI 代理 ──
  'POST /api/v1/ai/generate-plan': async (req, res, body) => {
    return proxyToAI(req, res, body, '/api/lesson-plan/generate')
  },

  'POST /api/v1/ai/exam/generate': async (req, res, body) => {
    return proxyToAI(req, res, body, '/api/exam/generate')
  },

  'POST /api/v1/ai/chat': async (req, res, body) => {
    return proxyToAI(req, res, body, '/api/chat')
  },

  'GET /api/v1/ai/health': async (_req, res) => {
    const aiRes = await fetch(`${AI_SERVICE}/health`).catch(() => null)
    if (aiRes) {
      const data = await aiRes.json()
      return resJson(res, 200, data)
    }
    return resJson(res, 503, { status: 'unavailable' })
  },
}

// ── 代理 AI 请求到 Python 服务 ──
async function proxyToAI(req, _res, body, path) {
  const headers = { 'Content-Type': 'application/json' }
  // 转发 Authorization header
  if (req.headers.authorization) {
    headers['Authorization'] = req.headers.authorization
  }
  const aiRes = await fetch(`${AI_SERVICE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body || {}),
  }).catch(() => null)
  if (!aiRes) {
    return resJson(_res, 503, { message: 'AI 服务暂时不可用', success: false })
  }
  const data = await aiRes.json()
  // 适配前端响应格式
  return resJson(_res, 200, { content: data.content || data.response || JSON.stringify(data), success: true })
}

function resJson(res, code, data) {
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  })
  res.end(JSON.stringify(data))
}

function parseBody(req) {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', c => (data += c))
    req.on('end', () => {
      try { resolve(JSON.parse(data)) } catch { resolve(null) }
    })
  })
}

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    return res.end()
  }

  const url = new URL(req.url, `http://localhost:${PORT}`)
  const path = url.pathname
  const key = `${req.method} ${path}`

  // 支持动态路径匹配（如 /api/v1/ai/exam/generate 匹配 POST /api/v1/ai/...)
  const body = ['POST', 'PUT'].includes(req.method) ? await parseBody(req) : {}

  if (routes[key]) {
    return routes[key](req, res, body)
  }

  // 通配 API 返回 200（兼容演示模式）
  console.log(`[dev] ${req.method} ${path} → 200 (mock)`)
  resJson(res, 200, { success: true, message: 'mock', data: null })
})

server.listen(PORT, () => {
  console.log(`\n🔧 知微 dev mock 后端已启动: http://localhost:${PORT}`)
  console.log(`📡 AI 代理目标: ${AI_SERVICE}`)
  console.log(`👤 演示帐号: 13800000002 / teacher123 (教师)`)
  console.log(`👤 演示帐号: 13800000001 / admin123 (管理员)\n`)
})
