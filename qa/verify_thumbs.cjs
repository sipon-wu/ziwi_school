/**
 * PPT 编辑器左栏缩略图（数量 / 内容是真实渲染 / 比例 / 与库内容同步）—— 2026-09-29 立
 *
 * 为什么补这条：清退存量守卫时 `verify_thumbs` 退役，而**"缩略图"这块没有登记守卫**
 * （见 `qa/RETIRED.md` 缺口清单）。缩略图是教师的"翻页地图"：数量对不上＝丢页/多页，
 * 内容变线框＝看不到真实排版（旧实现真踩过这条）。
 *
 * 判据（真浏览器 + 真库内容；2026-09-29 探针实测后按**内容标记**写，不跟 class 较劲）：
 *   ① **数量 == 1 封面 + 正文页数**（正文页数按库内容里的 `## ` 段数算 —— 探针实测这个口径成立）；
 *   ② 每张缩略图**有文字**（线框只有灰条、0 字），且**含该页独有的内容标记**（与画布同源渲染）；
 *   ③ 比例是 16:9 或 4:3 且尺寸非零（不是塌成 0 的空盒）；
 *   ④ 正文页**标题逐页出现且顺序一致**（页序语义：列表第 0 项是封面）；
 *   ⑤ 全程 pageerror = 0。
 *
 * 变异（M3 · **强形态**）：`MUTATE=1` 时用 psql **真改库**把最后一页（`## 页四丁` 段）删掉 →
 *   重新打开编辑器：缩略图数量必须 **5 → 4** 且该页标题**消失**（证明缩略图与页列表读的是**库里的真内容**，
 *   不是前端缓存/写死）。跑完把原内容写回（finally 无条件执行），再删掉测试课件。
 *
 * 用法：`node qa/verify_thumbs.cjs`（约 30s：一次造件 + 两次打开编辑器）
 *       `MUTATE=1 node qa/verify_thumbs.cjs`
 */
const { execFileSync } = require('child_process')
const { chromium } = require('playwright')
const { must, report } = require('./lib/assert.cjs')

const B = process.env.BASE || 'http://school1.ziwi.cn'
const PHONE = process.env.PHONE || '13800000002'
const PASS = process.env.PASS || 'teacher123'
const MUTATE = process.env.MUTATE === '1'
const STAMP = Date.now()
const NAME = `__E2E缩略图自检_${STAMP}`
const PAGES = ['页一甲', '页二乙', '页三丙', '页四丁']      // 正文页（各带唯一标记）
const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64')
const els = [0, 1, 2].map(i => ({
  id: 'el_p_' + i, type: 'text', x: 6 + i * 30, y: 30, w: 26, h: 50,
  text: `标记要点${i + 1}`, fontSize: 20, color: '353535', bullet: true,
}))
const CONTENT = [
  '# 缩略图自检', '',
  ...PAGES.flatMap((t, i) => [`## ${t}`, `- ${t}行的正文内容`, ...(i === 0 ? ['', `<!-- CW-EL:${b64(els)} -->`] : []), '']),
].join('\n')

/** 直连数据库（变异模式专用）：**真改库**里的课件内容，看缩略图是否跟着变 */
const SSH = process.env.SSH_TARGET || 'root@193.112.163.147'
const ENV_FILE = process.env.ENV_FILE || '/opt/zhiwei/code/deploy/.env.staging'
const psql = (sql) => {
  try {
    return execFileSync('ssh', [SSH,
      `set -a; . ${ENV_FILE}; set +a; docker exec -i zhiwei-postgres-staging psql -U "$DB_USER" -d "$DB_NAME" -t -A -c ${JSON.stringify(sql)}`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n').map(s => s.trim()).filter(s => s && !/^WARNING|^DETAIL|^HINT|collation/i.test(s)).join('\n')
  } catch { return null }
}

let br, id, origContent
;(async () => {
  const jread = async (r, what) => {
    const txt = await r.text()
    if (txt && !/^\s*[{[]/.test(txt)) {
      console.log(`   [SKIP] ${what} 返回非 JSON（HTTP ${r.status}）→ 环境未就绪，本套件**未验证**（skip ≠ pass）`)
      process.exit(2)
    }
    return txt ? JSON.parse(txt) : null
  }
  const lg = await jread(await fetch(`${B}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: PHONE, password: PASS }),
  }), '登录')
  must(!!lg.token, '教师登录成功', { user: lg.user && lg.user.name })
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + lg.token }

  const cr = await jread(await fetch(`${B}/api/materials/json`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ name: NAME, type: 'courseware', format: 'ppt', content: CONTENT, status: 'draft', subject: '语文', grade: '四年级' }),
  }), '造课件')
  id = cr && cr.id
  must(!!id, '造一份 4 页 PPT 课件（含唯一内容标记）', { id, pages: PAGES.length })

  br = await chromium.launch()
  const p = await br.newPage({ viewport: { width: 1440, height: 900 } })
  const errs = []
  p.on('pageerror', e => errs.push(String(e.message).slice(0, 120)))
  await p.goto(`${B}/login`, { waitUntil: 'domcontentloaded' })
  await p.evaluate(([t, u]) => { localStorage.setItem('zhiwei_token', t); localStorage.setItem('user', JSON.stringify(u)) }, [lg.token, lg.user])

  /** 打开编辑器并采集缩略图（选择器 = SlideThumb 根：pointer-events-none select-none overflow-hidden bg-white） */
  const readThumbs = async () => {
    await p.goto(`${B}/courseware/ppt/${id}/edit`, { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(9000)
    return p.evaluate(() => {
      const thumbs = [...document.querySelectorAll('div.pointer-events-none.select-none.overflow-hidden.bg-white')]
      const items = [...document.querySelectorAll('div.group.w-full')]
      return {
        thumbs: thumbs.map((el, i) => {
          const box = el.getBoundingClientRect()
          return {
            i, w: Math.round(box.width), h: Math.round(box.height),
            ratio: box.height ? +(box.width / box.height).toFixed(3) : 0,
            txt: (el.innerText || '').replace(/\s+/g, ''),
          }
        }),
        titles: items.map(x => (x.innerText || '').replace(/\s+/g, ' ')),
      }
    })
  }

  const r1 = await readThumbs()
  const expect1 = 1 + PAGES.length
  must(r1.thumbs.length === expect1,
    `① 缩略图数量 == 1 封面 + ${PAGES.length} 正文页 = ${expect1}（探针实测口径：正文页数 = 库内容里的 \`## \` 段数）`,
    { got: r1.thumbs.length })
  const blank = r1.thumbs.filter(t => t.txt.length === 0)
  must(blank.length === 0,
    '② 每张缩略图**都有文字**（线框只有灰条、0 字 → 视为"看不到真实排版"）',
    { blank: blank.map(t => t.i) })
  const missMark = []
  PAGES.forEach((t, i) => {
    const th = r1.thumbs[i + 1]                                  // 第 0 张是封面
    if (!th || !th.txt.includes(t)) missMark.push(`${t}（第 ${i + 1} 页缩略图）`)
  })
  must(missMark.length === 0,
    '② 每张缩略图**含该页独有的内容标记**（与画布同源渲染，不是示意线框）', { miss: missMark })
  must(r1.thumbs[1] && r1.thumbs[1].txt.includes('标记要点1'),
    '② 带 CW-EL 元素的那页，缩略图里能看到**元素文字**（组件与缩略图同源）',
    { sample: r1.thumbs[1] && r1.thumbs[1].txt.slice(0, 40) })
  const badRatio = r1.thumbs.filter(t => t.w === 0 || t.h === 0 || (Math.abs(t.ratio - 1.778) > 0.02 && Math.abs(t.ratio - 1.333) > 0.02))
  must(badRatio.length === 0,
    '③ 比例是 16:9 或 4:3 且尺寸非零（不是塌成 0 的空盒）',
    { bad: badRatio.map(t => `${t.i}:${t.w}×${t.h}@${t.ratio}`) })
  const orderBad = []
  PAGES.forEach((t, i) => { if (!(r1.titles[i + 1] || '').includes(t)) orderBad.push(`第 ${i + 1} 项应含「${t}」：${(r1.titles[i + 1] || '').slice(0, 20)}`) })
  must(orderBad.length === 0, '④ 正文页标题**逐页出现且顺序一致**（列表第 0 项是封面）', { bad: orderBad })
  must(errs.length === 0, '⑤ 全程 pageerror = 0', { errs })

  /* ── 变异（强形态）：真改库删掉最后一页 → 缩略图必须跟着少一张 ── */
  if (MUTATE) {
    /**
     * ⚠ 写库方式不能拼字面量：psql 经过 `ssh` + shell 后，`JSON.stringify` 会把换行变成**字面 `\n`**，
     * PostgreSQL 不把它当换行 → 内容塌成一整行 → markdown 解析出 **0 页**（2026-09-29 实测踩到，
     * 首版变异因此"看起来像产品坏了"，其实是**注入手法写错**）。
     * 改用 **base64 + decode()**：字符串里没有引号/换行，怎么过 shell 都不变形。
     */
    const setContent = (text) => `UPDATE materials SET content = convert_from(decode('${Buffer.from(text, 'utf8').toString('base64')}', 'base64'), 'UTF8') WHERE id='${id}'`
    origContent = String((await jread(await fetch(`${B}/api/materials/${id}`, { headers: H }), '读原内容')).content || '')
    const cut = origContent.split('\n').filter(l => !/^## 页四丁/.test(l) && !/^\- 页四丁行的正文内容/.test(l)).join('\n')
    const r = psql(setContent(cut))
    if (r === null) {
      console.log('   [SKIP] 强形态变异需改库（ssh/psql 不可用）→ 本项**未验证**（skip ≠ pass）')
      process.exit(2)
    }
    try {
      const r2 = await readThumbs()
      must(r2.thumbs.length === expect1 - 1,
        `【变异测试·真注入】psql **绕过 API** 删掉库里最后一页后重开编辑器 → 缩略图数量必须 ${expect1} → ${expect1 - 1}`,
        { got: r2.thumbs.length })
      const gone = !r2.titles.some(t => (t || '').includes('页四丁'))
      must(gone && r2.titles.some(t => (t || '').includes('页三丙')),
        '【变异测试·真注入】被删那页的标题**消失**、其余页仍在（页列表读的是库里的真内容）',
        { gone, stillHas3: r2.titles.some(t => (t || '').includes('页三丙')) })
    } finally {
      psql(setContent(origContent || CONTENT))   // 还原（同样走 base64，避免二次变形）
    }
  }

  report()
})().catch(e => {
  console.error('✘ 守卫自身异常：' + e.message)
  process.exitCode = 2
}).finally(async () => {
  try { await br?.close() } catch { /* noop */ }
  if (!id) return
  try {
    const lg = await (await fetch(`${B}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: PHONE, password: PASS }),
    })).json()
    const st = (await fetch(`${B}/api/materials/${id}`, {
      method: 'DELETE', headers: { Authorization: 'Bearer ' + lg.token },
    })).status
    console.log(`   [cleanup] 测试课件已删除：${st}`)
  } catch (e) {
    console.log(`   [cleanup] 删除失败（需人工看一眼）：${e.message}`)
  }
})
