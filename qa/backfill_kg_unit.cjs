/**
 * KG 单元（tb_kg_node.dan_yuan）回填（2026-09-17）
 *
 * 背景（实测）：
 *   - 种子里 kg_nodes **7132/7132 条全有 dan_yuan**，version_standard_maps 763/763 也有
 *   - seed 代码确实写它（backend/cmd/seed/knowledge/main.go:224 `DanYuan: n.DanYuan`）
 *   - 但运行时接口返回的节点 `unit` **全为空** → 说明当前库是「dan_yuan 列已存在、但未回填」
 *     （典型成因：模型后加字段、库未重灌）
 *   ⇒ 断点在**数据**，不在代码。
 *
 * 为什么不用"重跑 seed"来修：seed 是 truncate-再插入（main.go 先清 tb_kg_node 等表），
 * 重跑会**换掉节点 id**，而 materials.knowledge_node_ids 存的是这些 id → 已有课件的知识点会悬空。
 * 故这里只做**原地填补**：仅更新 dan_yuan 为空的行的这一列，不动 id、不动其它列。
 *
 * 用法：
 *   node qa/backfill_kg_unit.cjs            # 干跑：只读本地种子，打印将回填多少条（不联网）
 *   node qa/backfill_kg_unit.cjs --apply    # 执行：ssh + docker exec psql（需你在场批准）
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const SEED = path.join(ROOT, 'code/backend/data/knowledge_seed.json')
const SERVER = process.env.SERVER || 'root@193.112.163.147'
const CONTAINER = process.env.PG_CONTAINER || 'zhiwei-postgres-staging'
const APPLY = process.argv.includes('--apply')

const sqlEsc = s => String(s).replace(/'/g, "''")

;(async () => {
  const seed = JSON.parse(fs.readFileSync(SEED, 'utf8'))
  const nodes = seed.kg_nodes || []
  // node_key 唯一 → 单元；只挑真有单元的
  const map = new Map()
  for (const n of nodes) {
    if (n && n.node_key && n.dan_yuan) map.set(String(n.node_key), String(n.dan_yuan))
  }
  const units = new Set(map.values())
  console.log(`种子：节点 ${nodes.length} 条，其中带单元 ${map.size} 条，涉及 ${units.size} 个不同单元`)
  const sample = [...map.entries()].slice(0, 3)
  console.log('样例：' + sample.map(([k, v]) => `${k} → ${v}`).join(' · '))

  // 只更新"空值"的行走这一列；带 WHERE 护栏，重复执行无副作用
  const stmts = []
  for (const [key, unit] of map) {
    stmts.push(`UPDATE tb_kg_node SET dan_yuan = '${sqlEsc(unit)}' WHERE node_key = '${sqlEsc(key)}' AND (dan_yuan IS NULL OR dan_yuan = '');`)
  }
  const sql = [
    'BEGIN;',
    '-- 回填前计数（用于回滚核对）',
    'SELECT count(*) AS nodes, count(NULLIF(dan_yuan, \'\')) AS with_unit FROM tb_kg_node;',
    ...stmts,
    'SELECT count(*) AS nodes, count(NULLIF(dan_yuan, \'\')) AS with_unit FROM tb_kg_node;',
    'COMMIT;',
  ].join('\n')

  const out = '/tmp/backfill_kg_unit.sql'
  if (!APPLY) {
    console.log(`\n[干跑] 将执行 ${stmts.length} 条 UPDATE（SQL 已生成到 ${out}）`)
    console.log('每条形如：UPDATE tb_kg_node SET dan_yuan = \'<单元>\' WHERE node_key = \'<key>\' AND (dan_yuan IS NULL OR dan_yuan = \'\');')
    console.log('安全护栏：① 只写 dan_yuan 一列 ② 只动空值行 ③ 整包 BEGIN/COMMIT ④ 前后各打一次计数')
    console.log('\n要真正执行：node qa/backfill_kg_unit.cjs --apply（需你在场批准 ssh）')
  } else {
    fs.writeFileSync(out, sql)
    const who = execFileSync('ssh', [SERVER, `docker exec ${CONTAINER} sh -c 'echo $POSTGRES_USER:$POSTGRES_DB'`], { encoding: 'utf8' }).trim()
    const [user, db] = who.split(':')
    console.log(`\n[执行] 目标 ${SERVER} / ${CONTAINER} / ${user}:${db}`)
    const res = execFileSync('ssh', [SERVER, `docker exec -i ${CONTAINER} psql -U ${user} -d ${db} -v ON_ERROR_STOP=1 -f -`],
      { input: fs.readFileSync(out), encoding: 'utf8' })
    console.log(res.split('\n').filter(l => /nodes|with_unit|UPDATE|COMMIT|BEGIN|ERROR/.test(l)).slice(0, 12).join('\n'))
  }
})().catch(e => { console.error('失败:', e.message); process.exit(1) })
