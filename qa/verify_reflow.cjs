// 「重新套版」（重档）语义的**确定性单测**（2026-09-15）——不依赖浏览器、不依赖 LLM。
// 判据（三条，全部来自"重排"的定义）：
//   ① 偏离骨架的元素 → 被吸回骨架槽位（= 该版式 getSkeleton 的某个 rect，逐值相等）
//   ② 带 slotKey 的元素 → 回到**它自己的**槽位（不被循环分配挪到别的槽）
//   ③ pages/elements 统计 = 真实被重排的数量（二次确认里报给教师的数就是它）
//   ④ 幂等：对已重排的结果再跑一次，几何不再变化
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const FE = path.resolve(__dirname, '../code/frontend')
const OUT = '/tmp/cw_bundle.cjs'

;(async () => {
  execSync(
    `npx esbuild src/lib/cwTemplate.ts --bundle --format=cjs --platform=node --alias:@shared=../shared --define:import.meta.env={} --outfile=${OUT} --log-level=error`,
    { cwd: FE, stdio: 'inherit' },
  )
  if (!fs.existsSync(OUT)) { console.log('FAIL：bundle 未产出'); process.exit(1) }
  global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
  const M = require(OUT)
  const { reflowToSkeleton, getSkeleton } = M

  let bad = 0
  const chk = (cond, msg) => { if (!cond) { bad++; console.log('   ✘ ' + msg) } else console.log('   ✔ ' + msg) }

  const lay = 'image-text'
  const sk = getSkeleton(lay, { styleKey: '' })
  const slots = (sk?.placeholders || []).map(p => `${p.rect.x},${p.rect.y},${p.rect.w},${p.rect.h}`)
  console.log(`版式 ${lay} 的骨架槽位：${slots.join(' | ')}`)

  // ① 偏离骨架的元素（x=10,y=60 / x=80,y=90 —— 明显不在槽位上）
  const outline = [{
    title: '甲', layout: lay,
    elements: [
      { id: 'a', type: 'text', x: 10, y: 60, w: 20, h: 10, text: '第一段' },
      { id: 'b', type: 'text', x: 80, y: 90, w: 5, h: 5, text: '第二段' },
    ],
  }]
  const r1 = reflowToSkeleton(outline, '')
  const got1 = r1.outline[0].elements.map(e => `${e.x},${e.y},${e.w},${e.h}`)
  console.log(`① 重排后：${got1.join(' | ')}`)
  chk(got1.every(g => slots.includes(g)), '① 每个元素都落在骨架槽位上（逐值相等）')
  chk(JSON.stringify(r1.outline[0].elements.map(e => e.text)) === JSON.stringify(['第一段', '第二段']),
    '① 文字内容未被改动')
  chk(r1.outline[0].elements.every(e => e.w > 5), '① 尺寸也被改写（原来 w=5 的也被撑到槽位宽）')
  chk(r1.pages === 1 && r1.elements === 2, `① 统计正确：pages=${r1.pages} elements=${r1.elements}`)

  // ② 带 slotKey 的元素回到自己的槽位
  const keyed = [{
    title: '乙', layout: lay,
    elements: [{ id: 'x', type: 'text', x: 1, y: 1, w: 1, h: 1, slotKey: (sk?.placeholders?.[1]?.key || 'image'), overridden: false, text: '带槽位引用' }],
  }]
  const r2 = reflowToSkeleton(keyed, '')
  const ph1 = sk?.placeholders?.[1]
  const e2 = r2.outline[0].elements[0]
  console.log(`② 带 slotKey="${e2.slotKey}" → (${e2.x},${e2.y},${e2.w},${e2.h})，该槽位应为 (${ph1?.rect.x},${ph1?.rect.y},${ph1?.rect.w},${ph1?.rect.h})`)
  chk(e2.x === ph1.rect.x && e2.y === ph1.rect.y && e2.w === ph1.rect.w && e2.h === ph1.rect.h,
    '② 回到**它自己的**槽位（未被循环分配挪走）')

  // ③ 幂等
  const r3 = reflowToSkeleton(r1.outline, '')
  chk(JSON.stringify(r3.outline[0].elements.map(e => `${e.x},${e.y},${e.w},${e.h}`)) === JSON.stringify(got1),
    '③ 幂等：对已重排的结果再跑一次，几何不再变化')

  console.log(bad === 0 ? '\n结论：重档语义全部通过 ✔' : `\n结论：${bad} 项未通过 ✘`)
  process.exit(bad ? 1 : 0)
})().catch(e => { console.error('ERR', e.message); process.exit(1) })
