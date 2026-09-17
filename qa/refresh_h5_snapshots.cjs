// 刷新 H5 快照（2026-09-15）：手机扫码/投屏打开的是 `/api/materials/:id/h5`，
// 该端点**直接吐库里存的 h5_html**（草稿也一样，因为保存草稿时会写它）。
// 于是渲染器的修复（剥 `>` 残留 / 词卡防挤压 / HD 舞台 / 整页适配）如果不重算快照，
// 教师手机上看到的仍是旧渲染器的结果 —— 上一轮"改了却看不到"就是这个原因。
// 做法：本地用**同一份渲染器**重算 h5_html → PUT 回库 → 回读自证（含新标记、且不再有 `> 文本` 残留）。
const { execFileSync } = require('child_process')
const B = 'http://school1.ziwi.cn'
const FE = '/Users/sipon/CodeBuddy/AI教案/code/frontend'
const log = (...a) => console.log(...a)

;(async () => {
  execFileSync('npx', ['esbuild', 'src/lib/courseware-h5/index.ts', '--bundle', '--format=cjs', '--platform=node',
    '--alias:@shared=../shared', '--alias:@styles=../ai-service/skills/shared/styles',
    '--define:import.meta.env={}', '--outfile=/tmp/h5r.cjs', '--log-level=error'], { cwd: FE, stdio: 'inherit' })
  const { markdownToStorybookH5 } = require('/tmp/h5r.cjs')
  const lg = await (await fetch(B + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '13800000002', password: 'teacher123' }),
  })).json()
  const t = lg.token
  // 署名用**账号真实名称**（2026-09-15 准确性修正）：此前这里写死"张真真"，
  // 而该账号在库里叫"李老师" —— 快照上的署名必须与账号一致，不能被脚本自造。
  const realName = (lg.user && lg.user.name) || ''
  log(`署名用账号名称：${realName || '(空)'}`)
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }
  const all = (await (await fetch(B + '/api/materials', { headers: H })).json()).items || []
  const h5s = all.filter(x => String(x.format) === 'h5' && !/（旧/.test(String(x.name)))
  log(`H5 课件 ${h5s.length} 份（已排除作废件）`)

  for (const it of h5s) {
    const m = await (await fetch(`${B}/api/materials/${it.id}`, { headers: H })).json()
    const html = markdownToStorybookH5(String(m.content || ''), {
      subject: m.subject || '语文', grade: m.grade || '四年级',
      title: String(m.name || '').replace(/_课件$/, ''),
      teacherName: realName, themeId: m.theme_id || '', colorRoot: m.color_root || '',
    })
    if (!html) { log(`  ${m.name} → ✘ 渲染为空，跳过`); continue }
    const before = String(m.h5_html || '')
    m.h5_html = html
    const r = await fetch(`${B}/api/materials/${it.id}`, { method: 'PUT', headers: H, body: JSON.stringify(m) })
    const back = await (await fetch(`${B}/api/materials/${it.id}`, { headers: H })).json()
    const h = String(back.h5_html || '')
    const hasMarker = /scene-inner/.test(h) && /flex:0 0 auto/.test(h)
    const dirtyQuote = /> [\u4e00-\u9fa5]/.test(h.replace(/<[^>]*>/g, ''))
    log(`  ${String(back.name).padEnd(30)} HTTP ${r.status} 快照 ${before.length}→${h.length} 字 · 新渲染器标记=${hasMarker} · 残留"> 文本"=${dirtyQuote}`)
  }
  log('DONE')
})().catch(e => { console.error('FAIL:', e.message); process.exit(2) })
