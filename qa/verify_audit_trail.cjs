/**
 * 审计链守卫（2026-09-18 立）
 *
 * 用户定调："从审计的角度，也应该本人"（素材写权限仅本人）。本脚本守的是**审计链本身可用**——
 * 权限收窄到本人只解决"写者唯一 ⇒ 记录可归责"，但前提是**记录真的存在**。实测发现三处断裂：
 *
 *   ① `versions.payload` 是 **jsonb**，而发布留痕直接写 markdown/HTML（非合法 JSON）→ PG 报
 *      `invalid input syntax for type json`，错误被"不影响发布"的 log 吞掉 →
 *      **发布留痕从未落库**（staging 实测 `kind='release'` 恒为 0）。→ 断言"发布后必有 release 且可解析"。
 *   ② `audit_logs` 表在存量库**根本不存在**（DDL 在 001 基线里，而 deploy 显式跳过基线）→
 *      IT 审计写入被 `_ =` 吞掉，审计为零。→ 断言表存在且能写入。
 *   ③ 素材硬删会把它的 release 留痕**级联删掉**（原生 SQL 绕过 Version 的 BeforeDelete 钩子）→
 *      证据链断裂。→ 断言"删除后留痕仍在"。
 *
 * 依赖：可直接 ssh 到部署机的环境（用 psql 查 audit_logs）；ssh 不可用时该项**明确标注跳过**，不伪装通过。
 */
const { execFileSync } = require('child_process')
const { must, report } = require('./lib/assert.cjs')

const B = process.env.BASE || 'http://school1.ziwi.cn'
const SSH = process.env.SSH_TARGET || 'root@193.112.163.147'
const ENV_FILE = process.env.ENV_FILE || '/opt/zhiwei/code/deploy/.env.staging'
const NAME = '__E2E审计_课件'

const psql = (sql) => {
  try {
    return execFileSync('ssh', [SSH,
      `set -a; . ${ENV_FILE}; set +a; docker exec -i zhiwei-postgres-staging psql -U "$DB_USER" -d "$DB_NAME" -t -A -c ${JSON.stringify(sql)}`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n').map(s => s.trim()).filter(s => s && !/^WARNING|^DETAIL|^HINT|collation/i.test(s)).join('\n')
  } catch { return null }
}

;(async () => {
  const lg = await (await fetch(B + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: process.env.PHONE || '13800000002', password: process.env.PASS || 'teacher123' }),
  })).json()
  must(!!lg.token, '登录成功（测试账号）')
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + lg.token }
  const vers = async (id) => (await (await fetch(`${B}/api/versions?resource_type=courseware&resource_id=${id}`, { headers: H })).json()).items || []

  /* 建 → 发布 */
  const m = await (await fetch(B + '/api/materials/json', {
    method: 'POST', headers: H,
    body: JSON.stringify({ name: NAME, type: 'courseware', format: 'ppt', content: '# 审计\n\n## 页一\n- a\n', status: 'draft', subject: '语文', grade: '四年级' }),
  })).json()
  must(!!m.id, '建出草稿素材', { id: m.id })
  const cur = await (await fetch(`${B}/api/materials/${m.id}`, { headers: H })).json()
  const doPub = async () => {
    const r = await fetch(`${B}/api/materials/${m.id}`, { method: 'PUT', headers: H, body: JSON.stringify({ ...cur, status: 'active', content: cur.content + '\n## 页二\n- b\n' }) })
    return { status: r.status, body: await r.json().catch(() => ({})) }
  }
  let pub = await doPub()
  // 冷启动窗口（后端刚重启、ai-service 未就绪）后端会把本次发布**降级为草稿**并回 code=POLICY_UNAVAILABLE。
  // 这是**设计内的安全策略**、不是缺陷；等审核服务就绪后重试一次，让断言确定可复现。
  // （该静默降级此前只写日志、接口谎报成功，2026-09-18 已改为明确回告；见报告第十二轮。）
  if (pub.body?.code === 'POLICY_UNAVAILABLE') {
    console.log('   [note] 审核服务未就绪（冷启动窗口），后端已如实回告 code=POLICY_UNAVAILABLE，3s 后重试')
    await new Promise(r => setTimeout(r, 3000))
    pub = await doPub()
  }
  must(pub.status === 200, '发布（status=active + 内容变化）→ 200', { status: pub.status })
  must(pub.body?.status === 'active', '发布后**确实**为 active（防静默降级为草稿：审核不可用时须明确回告而非谎报成功）', { status: pub.body?.status, code: pub.body?.code })

  /* ① 发布留痕必须真的落库（此前因 payload 非 JSON 而静默失效） */
  const v1 = await vers(m.id)
  const rel = v1.filter(v => v.kind === 'release')
  must(rel.length >= 1, '发布后产生 release 留痕（此前**从未落库**：payload 非 JSON 被 PG 拒、错误被吞）', { versions: v1.map(v => v.kind) })
  const r0 = rel[0] || {}
  must(!!r0.published_by, '留痕含发布人 published_by（责任人）', { published_by: r0.published_by })
  must(!!r0.review_status, '留痕含审核结论 review_status', { review_status: r0.review_status })
  must(r0.version_no === 1, '留痕版本号 version_no=1（首个正式版本）', { version_no: r0.version_no })
  must(typeof r0.payload === 'string' || typeof r0.payload === 'object', '留痕 payload 可读出（jsonb 形态正确）', { payloadType: typeof r0.payload, head: String(JSON.stringify(r0.payload)).slice(0, 40) })

  /* ② audit_logs 表可用（存量库此前缺表 → IT 审计静默失效） */
  const tbl = psql(`SELECT count(*) FROM pg_tables WHERE tablename='audit_logs'`)
  if (tbl === null) {
    must(true, '跳过：ssh 不可用，无法核验 audit_logs（**未验证**，非通过）')
  } else {
    must(tbl === '1', 'audit_logs 表存在（存量库缺表曾导致审计写入全部静默失败）', { pgTables: tbl })
  }

  /* ③ 删除：留痕必须留存 + 删除动作本身要留痕 */
  const del = await fetch(`${B}/api/materials/${m.id}`, { method: 'DELETE', headers: H })
  must(del.status === 200, '本人删除 → 200', { status: del.status })
  const v2 = await vers(m.id)
  must(v2.filter(v => v.kind === 'release').length >= 1, '删除素材后 **release 留痕仍在**（级联不抹证据：原生 SQL 曾绕过 BeforeDelete 钩子）', { after: v2.map(v => v.kind) })
  must(v2.filter(v => v.kind === 'snapshot').length === 0, '草稿快照被正常级联清理（只留证据、不留垃圾）', { after: v2.map(v => v.kind) })

  if (tbl === '1') {
    const audit = psql(`SELECT action||'|'||resource_type||'|'||coalesce(resource_id,'-')||'|'||coalesce(details->>'name','-') FROM audit_logs WHERE resource_id='${m.id}' ORDER BY created_at DESC LIMIT 3`)
    must(!!audit && /delete/.test(audit), '删除动作写入 audit_logs（硬删无回收站，须留"谁删了什么"）', { audit })
    must(!!audit && audit.includes(NAME), '审计明细含素材名（可回答"删掉的是哪份"）', { audit })
    /* 测试残留清理：审计行与 release 留痕（原生 SQL 清 release 是"测试卫生"，非业务路径） */
    psql(`DELETE FROM audit_logs WHERE resource_id='${m.id}'`)
    psql(`DELETE FROM versions WHERE resource_id='${m.id}' AND kind='release'`)
  }
  report()
})().catch(e => {
  console.error('✘ 脚本异常：' + e.message)
  process.exit(2)
})
