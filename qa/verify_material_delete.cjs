/**
 * 素材写权限守卫（2026-09-18 立；原「删除接口守卫」，同日扩到 PUT）
 *
 * 背景：
 *   · 后端此前**没有** `DELETE /api/materials/:id` → 清库只能靠 SQL、e2e 基线件无法自清理
 *     （跑一次守卫就在库里留一条）。本轮新增该端点（只允许删**自己名下**、级联清批注/版本）。
 *   · `PUT /api/materials/:id` 此前**没有任何归属校验**（GetByID 不带范围过滤）→ 任何登录用户
 *     知道 id 即可改任意素材（含跨校、含平台公共装饰元件库）。
 *     口径（2026-09-18 用户拍板）：**仅本人**（`user_id = 本人`），与 DELETE 一致；
 *     平台公共资产（`user_id` 为空，如装饰元件库）同样不可改——注意实测它们的 `school_id`
 *     是真实学校，只查 school_id 拦不住。
 *
 * 本脚本守：
 *   ① 建临时件 → 删除 → 200 deleted=1 → 再查 404（真删掉了）
 *   ② 不存在的 id → 404（不泄露存在性）
 *   ③ 公共装饰元件（user_id 为空）不可被教师删除 → 404
 *   ④ 本人素材 PUT → 200（自己的课件照常能存）
 *   ⑤ 同事素材 PUT → 403（仅本人可改）；同事改自己的 → 200（确认不是"谁都改不了"）
 *   ⑥ 平台公共资产（装饰元件，user_id 为空）PUT → 403（此前放行 = 安全漏洞）
 *   ⑦ 基线件可清零（cleanupFixtures）→ 库内 `__E2E基线_` 归零（"跑完不留残留"）
 */
const { must, report } = require('./lib/assert.cjs')
const { session, ensurePptFixture, cleanupFixtures, PPT_NAME } = require('./lib/cwFixture.cjs')
const { B } = require('./lib/cwFixture.cjs')

;(async () => {
  const lg = await (await fetch(B + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: process.env.PHONE || '13800000002', password: process.env.PASS || 'teacher123' }) })).json()
  must(!!lg.token, '登录成功（测试账号）')
  const { H, get } = await session()
  const del = async (id) => (await fetch(`${B}/api/materials/${id}`, { method: 'DELETE', headers: H })).status

  /* ① 建 → 删 → 再查 */
  const created = await (await fetch(B + '/api/materials/json', {
    method: 'POST', headers: H,
    body: JSON.stringify({ name: '__E2E临时删除件', type: 'courseware', format: 'ppt', content: '# 临时\n\n## 页一\n- a\n', status: 'draft', subject: '语文', grade: '四年级' }),
  })).json()
  must(!!created.id, '建出临时件', { id: created.id })
  const s1 = await del(created.id)
  must(s1 === 200, '本人删除自己名下素材 → 200', { status: s1 })
  const after = await (await fetch(`${B}/api/materials/${created.id}`, { headers: H })).json()
  must(!after || !after.id, '删除后再查 → 不存在（真删）', { afterKeys: after ? Object.keys(after).slice(0, 4) : null })

  /* ② 不存在的 id */
  const s2 = await del('00000000-0000-0000-0000-000000000000')
  must(s2 === 404, '不存在的 id → 404（不泄露存在性）', { status: s2 })

  /* ③ 公共装饰元件（user_id 为空）不可删 */
  const dec = await (await fetch(B + '/api/decor?scope=public&limit=1', { headers: H })).json()
  const firstDecor = (dec.items || [])[0]
  if (firstDecor && firstDecor.id) {
    const s3 = await del(firstDecor.id)
    must(s3 === 404, '公共装饰元件（非本人名下）不可删 → 404', { status: s3, id: firstDecor.id })
  } else {
    must(true, '跳过公共装饰元件用例（本次无公共元件可取样）')
  }

  /* ④ 本人素材 PUT → 200（自己的课件照常能存） */
  const tmp2 = await (await fetch(B + '/api/materials/json', {
    method: 'POST', headers: H,
    body: JSON.stringify({ name: '__E2E临时更新件', type: 'courseware', format: 'ppt', content: '# 临时\n\n## 页一\n- a\n', status: 'draft', subject: '语文', grade: '四年级' }),
  })).json()
  must(!!tmp2.id, '建出临时件（PUT 用）', { id: tmp2.id })
  const detail = await (await fetch(`${B}/api/materials/${tmp2.id}`, { headers: H })).json()
  const putRes = await fetch(`${B}/api/materials/${tmp2.id}`, { method: 'PUT', headers: H, body: JSON.stringify({ ...detail, name: '__E2E临时更新件', content: '# 临时\n\n## 页一\n- a\n\n## 页二\n- b\n' }) })
  must(putRes.status === 200, '本人素材 PUT → 200', { status: putRes.status })

  /* ⑤ 同事素材 PUT → 403（仅本人可改）；同事改自己的 → 200（确认不是"谁都改不了"） */
  const lgB = await (await fetch(B + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: process.env.PHONE_B || '13800000003', password: process.env.PASS_B || 'teacher123' }),
  })).json()
  must(!!lgB.token, '同事账号登录成功（默认 13800000003 王老师，同校）')
  const HB = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + lgB.token }
  const tmpB = await (await fetch(B + '/api/materials/json', {
    method: 'POST', headers: HB,
    body: JSON.stringify({ name: '__E2E临时件_同事', type: 'courseware', format: 'ppt', content: '# 同事的\n\n## 页一\n- a\n', status: 'draft', subject: '数学', grade: '四年级' }),
  })).json()
  must(!!tmpB.id, '建出同事名下临时件', { id: tmpB.id })
  const dB = await (await fetch(`${B}/api/materials/${tmpB.id}`, { headers: H })).json()
  const putB = await fetch(`${B}/api/materials/${tmpB.id}`, { method: 'PUT', headers: H, body: JSON.stringify({ ...dB, name: dB.name }) })
  must(putB.status === 403, '同事素材 PUT（他人改）→ 403（仅本人可改）', { status: putB.status })
  const putBOwn = await fetch(`${B}/api/materials/${tmpB.id}`, { method: 'PUT', headers: HB, body: JSON.stringify({ ...dB, name: dB.name }) })
  must(putBOwn.status === 200, '同事改本人素材 → 200（非"谁都改不了"）', { status: putBOwn.status })
  await fetch(`${B}/api/materials/${tmpB.id}`, { method: 'DELETE', headers: HB }) // 本人自清

  /* ⑥ 平台公共资产（装饰元件）PUT → 403 */
  if (firstDecor && firstDecor.id) {
    const dDetail = await (await fetch(`${B}/api/materials/${firstDecor.id}`, { headers: H })).json()
    const dPut = await fetch(`${B}/api/materials/${firstDecor.id}`, { method: 'PUT', headers: H, body: JSON.stringify({ ...dDetail, name: dDetail.name }) })
    must(dPut.status === 403, '平台公共资产（装饰元件）PUT → 403（此前放行的安全漏洞）', { status: dPut.status, id: firstDecor.id })
  } else {
    must(true, '跳过公共资产 PUT 用例（本次无公共元件可取样）')
  }
  await del(tmp2.id) // 清掉本人 PUT 用例的临时件

  /* ⑦ 基线件可清零（跑完不留残留） */
  const fx = await ensurePptFixture()
  must(!!fx.id, '基线件已就绪（用于验证可清理）', { id: fx.id })
  const cleaned = await cleanupFixtures()
  must(cleaned.some(x => x.status === 200), '基线件删除返回 200', { cleaned })
  const listAfter = (await get('/api/materials')).items || []
  const left = listAfter.filter(m => String(m.name || '').startsWith('__E2E基线_'))
  must(left.length === 0, '库内 `__E2E基线_` 归零（跑完不留残留）', { left: left.map(m => m.name) })

  report()
})().catch(e => {
  console.error('✘ 脚本异常：' + e.message)
  process.exit(2)
})
