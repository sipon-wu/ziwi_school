/**
 * 断言与证据工具（2026-09-17）—— 配套 `qa/断言与证据规范.md`
 *
 * 目的：把"假绿"挡在源头。三类失效模式各有对应函数：
 *   A 局部→全局    → sampled()（分母 + limit 截断告警）、allOf()（强制带分母）
 *   B 恒真/弱断言  → notEmpty()（挡掉 includes('') 那类）、mustChange()（判状态变化）
 *   C 流程缺门禁   → report()（任一条失败即非 0 退出，脚本不会被当成"通过"）
 *
 * 用法：
 *   const { must, notEmpty, mustChange, sampled, allOf, report } = require('./lib/assert.cjs')
 *   sampled(items, { limit: 300, source: 'GET /api/ai/knowledge/nodes' })
 *   notEmpty(pickedUrl, '选中的素材 url')
 *   allOf(items, x => !!x.unit, '默认页 300 条全部有单元')
 *   report()
 */
let total = 0
let fails = 0

/** 断言 + 附证据（evidence 会原样打印，便于复核 —— 只打结论等于不可复核） */
function must(cond, label, evidence) {
  total++
  const ok = !!cond
  if (!ok) fails++
  const ev = evidence === undefined ? '' : '  ' + JSON.stringify(evidence)
  console.log(`${ok ? '  ✔ ' : '  ✘ '}${label}${ev}`)
  return ok
}

/** 非空断言：挡掉 `includes('')` / `startsWith('')` 这类**恒真**写法。
 *  evidence 可传入更贴切的证据（如 { len }），默认给值的摘要。 */
function notEmpty(v, label, evidence) {
  const isEmpty = v === null || v === undefined || String(v).trim() === '' || (Array.isArray(v) && v.length === 0)
  const fallback = { got: Array.isArray(v) ? `array(${v.length})` : String(v).slice(0, 60) }
  must(!isEmpty, label || '值非空', evidence === undefined ? fallback : evidence)
  return !isEmpty
}

/** 状态变化断言：点击/保存/请求**前后各取一次**，避免"看起来对" */
function mustChange(before, after, label) {
  return must(JSON.stringify(before) !== JSON.stringify(after), label || '状态发生变化', { before, after })
}

/** 样本口径：声明条数、来源、过滤，并在"达到 limit"时**告警**（规则 A2） */
function sampled(items, { limit, source, filter } = {}) {
  const n = Array.isArray(items) ? items.length : 0
  const tail = `${limit ? `（limit=${limit}）` : ''}${source ? ` · 来源 ${source}` : ''}${filter ? ` · 过滤 ${filter}` : ''}`
  console.log(`  i 样本：${n} 条${tail}`)
  if (limit && n >= limit) {
    console.log('  ⚠ 返回条数达到 limit —— 极可能被截断；**禁止**据此推断全量分布（规范 A2）')
  }
  return n
}

/** 分母断言：任何"全部 / 全没有"的结论必须带分母（规则 A1） */
function allOf(items, pred, label) {
  const arr = Array.isArray(items) ? items : []
  const hit = arr.filter(pred).length
  must(arr.length > 0 && hit === arr.length, label || '全部满足', { hit, total: arr.length })
  return { hit, total: arr.length }
}

/** 收口：任一条失败 → 非 0 退出（否则脚本会"跑完就当作通过"） */
function report() {
  console.log(`\n断言 ${total} 条，失败 ${fails} 条`)
  if (fails) {
    console.log('✘ 有用例未通过 → 退出码 1（不要把这次当成"通过"）')
    process.exit(1)
  }
  console.log('✔ 全部通过')
}

module.exports = { must, notEmpty, mustChange, sampled, allOf, report }
