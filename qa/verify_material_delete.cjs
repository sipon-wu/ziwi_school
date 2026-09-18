/**
 * 素材删除接口守卫（2026-09-18 立）
 *
 * 背景：后端此前**没有** `DELETE /api/materials/:id` → 清库只能靠 SQL、e2e 基线件无法自清理
 *      （跑一次守卫就在库里留一条）。本轮新增该端点（只允许删**自己名下**、级联清批注/版本）。
 *
 * 本脚本守：
 *   ① 建临时件 → 删除 → 200 deleted=1 → 再查 404（真删掉了）
 *   ② 不存在的 id → 404（不泄露存在性）
 *   ③ 公共装饰元件（user_id 为空）不可被教师删除 → 404
 *   ④ 基线件可清零（cleanupFixtures）→ 库内 `__E2E基线_` 归零（"跑完不留残留"）
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

  /* ④ 基线件可清零（跑完不留残留） */
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
