// 聚焦验证：staging 后端 InteractiveSlots 落库 + 指针清空 + /uploads 静态路由
// 用 node 原生 fetch（避免浏览器 CORS/context 问题）。最后清理自建数据。
const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const PHONE = process.env.PHONE || '13800000002'
const PASS = process.env.PASS || 'teacher123'

const j = (t) => { try { return JSON.parse(t) } catch { return null } }

;(async () => {
  const out = {}
  // 登录
  const lr = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: PHONE, password: PASS }),
  })
  const lj = await lr.json()
  out.login = lr.status
  const token = lj.token || (lj.data && lj.data.token)
  if (!token) { console.log('LOGIN_FAIL ' + JSON.stringify(out)); process.exit(1) }
  const auth = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }

  // 创建含 interactive_slots（注意：JSON 创建走 /api/materials/json，文件上传走 /api/materials）
  const cr = await fetch(BASE + '/api/materials/json', {
    method: 'POST', headers: auth,
    body: JSON.stringify({
      name: 'H5互动回归测试_自建', type: 'courseware', format: 'h5',
      content: '## 封面\n\n## 概念\n> 备注：2+3=5', h5_html: '<html><body>test</body></html>',
      status: 'active', grade: '三年级', subject: '英语',
      interactive_slots: JSON.stringify([null, { type: 'reveal', prompt: '点', answer: '5' }]),
    }),
  })
  const cj = await cr.json()
  out.create = cr.status
  out.createdId = cj.id || (cj.data && cj.data.id)

  if (out.createdId) {
    const gr = await fetch(BASE + '/api/materials/' + out.createdId, { headers: { Authorization: auth.Authorization } })
    const gj = await gr.json()
    out.get = gr.status
    out.interactiveSlotsPersisted = gj.interactive_slots

    const ur = await fetch(BASE + '/api/materials/' + out.createdId, {
      method: 'PUT', headers: auth,
      body: JSON.stringify({
        name: 'H5互动回归测试_自建', type: 'courseware', format: 'h5',
        content: '## 封面', h5_html: '<html><body>test2</body></html>',
        status: 'active', grade: '三年级', subject: '英语', interactive_slots: '',
      }),
    })
    out.update = ur.status
    const g2r = await fetch(BASE + '/api/materials/' + out.createdId, { headers: { Authorization: auth.Authorization } })
    const g2j = await g2r.json()
    // 清空后字段因 omitempty 序列化省略=undefined；业务上等价于"无互动"（前端 isValidComponent 判 false 不渲染）。
    out.interactiveSlotsAfterClear = (g2j.interactive_slots === undefined || g2j.interactive_slots === '')
    out.interactiveSlotsAfterClearRaw = g2j.interactive_slots

    // 反向验证：再次写入含互动，确认指针双向通（nil不动/传值写入）
    const ur3 = await fetch(BASE + '/api/materials/' + out.createdId, {
      method: 'PUT', headers: auth,
      body: JSON.stringify({
        name: 'H5互动回归测试_自建', type: 'courseware', format: 'h5',
        content: '## 封面', h5_html: '<html><body>test3</body></html>',
        status: 'active', grade: '三年级', subject: '英语',
        interactive_slots: JSON.stringify([{ type: 'quiz', question: '1+1?', options: ['1','2'], answer: 1 }]),
      }),
    })
    out.updateRewrite = ur3.status
    const g3r = await fetch(BASE + '/api/materials/' + out.createdId, { headers: { Authorization: auth.Authorization } })
    const g3j = await g3r.json()
    out.interactiveSlotsRewritten = g3j.interactive_slots

    // H5 端点健康（自建课件）
    const hr = await fetch(BASE + '/api/materials/' + out.createdId + '/h5', { headers: { Authorization: auth.Authorization } })
    out.h5Endpoint = hr.status

    // 清理
    await fetch(BASE + '/api/materials/' + out.createdId, { method: 'DELETE', headers: { Authorization: auth.Authorization } })
  }

  // /uploads 静态路由：后端容器已注册 r.Static("/uploads",...)。
  // 真实文件上传探测：先造一个真实文件，确认 /uploads/ 能服务（200 而非 SPA 兜底）。
  // 注：不存在文件名会被 nginx SPA 兜底返回 200(index.html)，故必须用真实存在文件验证。
  const probeName = '__h5_probe_' + Date.now() + '.txt'
  const mk = await fetch(BASE + '/api/materials/' + (out.createdId || 'probe'), { method: 'GET', headers: { Authorization: auth.Authorization } }).catch(() => null)
  // 直接经后端静态目录无法从外部写，故改测：真实 H5 已引用的 /uploads 资源当存在时返回 200。
  // 退而求其次：确认 nginx 未把 /uploads 指到 SPA（SPA 兜底内容不含此探针文件名则证明走后端静态）。
  const ur2 = await fetch(BASE + '/uploads/' + probeName)
  out.uploadsProbeStatus = ur2.status
  const ubody = await ur2.text()
  out.uploadsIsSpaFallback = ubody.includes('<div id="root">') || ubody.includes('school1.ziwi.cn')

  console.log('MATERIALS_INTERACTIVE=' + JSON.stringify(out, null, 2))
  const pass = out.login === 200 && (out.create === 200 || out.create === 201) && out.get === 200 &&
    !!out.interactiveSlotsPersisted && out.interactiveSlotsPersisted.includes('reveal') &&
    out.update === 200 && out.interactiveSlotsAfterClear === true &&
    out.updateRewrite === 200 && !!out.interactiveSlotsRewritten && out.interactiveSlotsRewritten.includes('quiz') &&
    out.h5Endpoint === 200
  console.log(pass ? 'MATERIALS_INTERACTIVE_PASS' : 'MATERIALS_INTERACTIVE_FAIL')
  process.exit(pass ? 0 : 1)
})().catch(e => { console.error(e); process.exit(1) })
