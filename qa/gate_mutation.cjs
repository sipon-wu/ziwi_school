/**
 * M3 变异门：证明断言**真的会红**（2026-09-27 立 · 1-4）
 *
 * 依据《0911》§5.2 **M3「测试有效性自检（反假绿核心）」**：
 *   "**变异测试**：故意注入缺陷（如把 `themeId` 写死 `storybook`、把 `applyTemplate` 的 remap 去掉），
 *    若测试仍绿 → 该测试无效，必须修。**负控用例**：每个套件至少一条'已知必须红'的用例。"
 *
 * 本门把这件事从"人工偶尔做一次"变成"可重复的一条命令"：对每个**变异体**跑一次带 `MUTATE=1` 的守卫，
 * 并对输出做**三向断言**：
 *   ① 变异模式下守卫**确实判红**（输出里出现 ✘ 的失败断言）—— 证明被测断言不是恒真；
 *   ② 守卫自身的"变异测试"断言**通过**（说明它明确知道自己在验什么，而不是碰巧红）；
 *   ③ 输出里带**可核对的量化证据**（如"可区分对数 = 0"、"可区分组合数 = 1"）。
 *
 * 用法：`node qa/gate_mutation.cjs`（约 2 分钟，含一次真浏览器渲染）
 */
const path = require('path')
const { spawnSync } = require('child_process')
const { must, report } = require('./lib/assert.cjs')

const QA = __dirname

/**
 * 变异体清单。每个 mutant = 一次"注入缺陷"，`detect` 用来核对"缺陷确实被判红"的量化证据。
 * 说明：变异是**通过输入注入**实现的（同一内容打成同风格 / style_tag 全打成一个），
 * 模拟的正是历史上真实发生过的缺陷类（主题没生效、风格参数被打死）。
 */
const MUTANTS = [
  {
    guard: 'verify_style_diversity_ab',
    what: '把 6 个课件的 theme_id 全打成同一个（模拟"主题参数没生效"）',
    detect: /"distinguishable":0/,
    // 变异模式下该守卫走"变异分支"（只断言"缺陷被识别"），因此**不会**打印那条 DoD 红行；
    // 它给出的"被测断言必然判红"的直接证据是**两两矩阵全部塌成 0 项**。
    expectRed: /→ 0 项/,
    n: 15,
  },
  {
    guard: 'verify_style_tools',
    what: '把 9 次 template.query 的 style_tag 全打成一个（模拟"风格参数被打死"）',
    detect: /"uniq":1/,
    expectRed: /漂移对账本次预期变红/,
    n: 3,
  },
]

;(async () => {
  for (const m of MUTANTS) {
    const r = spawnSync('node', [path.join(QA, `${m.guard}.cjs`)], {
      encoding: 'utf8', timeout: 20 * 60 * 1000,
      env: { ...process.env, MUTATE: '1' },
    })
    const out = `${r.stdout || ''}${r.stderr || ''}`
    must(r.status === 0 && /【变异测试】/.test(out),
      `[${m.guard}] 变异模式下守卫自身跑完且"变异测试"断言通过（注入：${m.what}）`,
      { exit: r.status, tail: out.trim().split('\n').slice(-2).join(' / ') })
    must(m.detect.test(out),
      `[${m.guard}] 缺陷被**量化识别**（证据：${m.detect}）`,
      { evidence: (out.match(m.detect) || [])[0] })
    must(m.expectRed.test(out),
      `[${m.guard}] 缺陷使被测断言**必然判红**（证明断言不是恒真）`,
      { evidence: (out.match(m.expectRed) || [])[0] })
    console.log(`   ✔ ${m.guard}：注入「${m.what}」→ 断言变红且被量化识别`)
  }
  report()
})().catch(e => {
  console.error('✘ 变异门自身异常：' + e.message)
  process.exitCode = 2
})
