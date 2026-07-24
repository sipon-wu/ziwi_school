/**
 * verify_exam_generate.cjs — 出题 AI 生成端到端验证
 *
 * 【假绿防御体系】
 * 1) 多路判据：渲染成功需 ≥2 个独立信号（卡片数+文案+按钮）
 * 2) 检测被登出：URL 或 body 是否 login 页
 * 3) 网络层验证：后端响应必须 status=200 且 len>100
 * 4) 监测 pageerror + console.error 双通道
 * 5) 所有检测项原始值写入 JSON 输出，不依赖单一选择器
 * 6) 文件日志 + 截图保证可回溯（防纸绿）
 * 7) process.stdout.write + process.exit 确保输出不被吞
 *
 * 用法:
 *   BASE=http://school1.ziwi.cn node qa/verify_exam_generate.cjs
 *   PHONE=13800000002 PASS=teacher123 node qa/verify_exam_generate.cjs
 *
 * 退出码: 0=PASS 1=FAIL
 * 输出: stdout 一行 JSON {status, verdicts, checks}
 */

const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')

const BASE       = process.env.BASE  || 'http://school1.ziwi.cn'
const PHONE      = process.env.PHONE || '13800000002'
const PASS       = process.env.PASS  || 'teacher123'
const SHOTS_DIR  = path.join(__dirname, '_shots')
const LOGS_DIR   = path.join(__dirname, '_logs')
const LOGFILE    = path.join(LOGS_DIR, 'vxg_' + Date.now() + '.log')

const sleep = ms => new Promise(r => setTimeout(r, ms))

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19)
  const line = '[' + ts + '] ' + msg
  try { fs.appendFileSync(LOGFILE, line + '\n') } catch {}
  process.stderr.write(line + '\n')
}

function emit(res, code) {
  process.stdout.write(JSON.stringify(res) + '\n')
  process.exit(code)
}

async function main() {
  try { fs.mkdirSync(LOGS_DIR, { recursive: true }) } catch {}
  try { fs.mkdirSync(SHOTS_DIR, { recursive: true }) } catch {}
  log('START')

  const browser = await chromium.launch()
  const ctx = await browser.newContext()
  const page = await ctx.newPage()

  // 监测通道
  const pe = [], cerr = []
  page.on('pageerror',   e => pe.push(String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') cerr.push(m.text()) })

  // 网络响应验证
  let netOk = false, netStatus = 0, netLen = 0
  page.on('response', async (resp) => {
    if (resp.url().includes('/api/ai/exam/generate')) {
      netStatus = resp.status()
      try { netLen = (await resp.text()).length } catch {}
      netOk = netStatus === 200 && netLen > 100
      log('NET status=' + netStatus + ' len=' + netLen + ' ok=' + netOk)
    }
  })

  const res = { status: 'FAIL', checks: {}, verdicts: [] }

  try {
    // ① 登录
    log('login')
    await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.fill('input[placeholder="请输入手机号"]', PHONE)
    await page.fill('input[placeholder="请输入密码"]', PASS)
    await page.click('button[type=submit]')
    await page.waitForLoadState('domcontentloaded').catch(() => {})
    await sleep(2500)

    // ② 检测被登出
    const bounced = await page.evaluate(() => {
      return document.body.innerText.includes('登录') && document.querySelector('input[placeholder="请输入手机号"]') !== null
    })
    res.checks.bounced = bounced
    if (bounced) res.verdicts.push('登录失败或被重定向回登录页')

    // ③ 进入出题页
    log('goto /exercises/new')
    await page.goto(BASE + '/exercises/new', { waitUntil: 'domcontentloaded' }).catch(() => {})
    await sleep(8000)

    // ④ autoSelect
    res.checks.autoSelect = await page.evaluate(() => {
      const m = document.body.innerText.match(/\((\d+)\/12\)/); return m ? parseInt(m[1]) : 0
    })
    log('autoSelect=' + res.checks.autoSelect)

    // ⑤ 展开小微 → 对话
    log('open XiaoWei')
    await page.locator('button', { hasText: '小微对话' }).first().click()
    await sleep(1500)
    await page.locator('input[placeholder="输入补充需求..."]').fill('请出几道基础选择题')
    await page.locator('input[placeholder="输入补充需求..."]').press('Enter')
    await sleep(13000)

    // ⑥ 点击应用到当前内容
    const applyN = await page.locator('button', { hasText: '应用到当前内容' }).count()
    res.checks.applyBtnCount = applyN
    log('apply count=' + applyN)
    if (applyN === 0) {
      res.verdicts.push('"应用到当前内容"按钮未出现（小微未回复）')
    } else {
      await page.locator('button', { hasText: '应用到当前内容' }).first().click()
      log('clicked apply, poll 90s')

      // ⑦ 轮询：判据 = 文案组合，防非题目元素触发
      let found = false, pollSec = 0
      for (let i = 0; i < 45; i++) {
        const st = await page.evaluate(() => {
          const b = document.body.innerText
          return { topic: b.includes('知识图谱选题'), student: b.includes('学生卷'), fail: /出题失败/.test(b) }
        })
        if (st.topic || st.student || st.fail) {
          found = true; pollSec = i * 2
          res.checks.pollTrigger = st.topic ? 'topicLabel' : st.student ? 'studentLabel' : 'failToast'
          log('poll at ' + pollSec + 's trigger=' + res.checks.pollTrigger)
          break
        }
        await sleep(2000)
      }
      res.checks.pollSeconds = pollSec
      res.checks.pollFound = found

      // ⑧ 全方位诊断：多路判据原材料
      const diag = await page.evaluate(() => {
        const b = document.body.innerText
        const btns = [...document.querySelectorAll('button')].map(btn => (btn.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
        return {
          btns: btns,
          hasStudentWord: btns.some(t => t.includes('学生') && (t.includes('卷') || t.includes('Word'))),
          hasPdf: btns.some(t => t.includes('PDF')),
          hasMode: btns.some(t => (t.includes('AI') && t.includes('模式')) || (t.includes('文档') && t.includes('模式'))),
          cards: document.querySelectorAll('.bg-\\[\\#F6F7F8\\]').length,
          failToast: /出题失败/.test(b),
          topicLabel: b.includes('知识图谱选题'),
          docHint: b.includes('文档模式为所见即所得'),
          onLogin: b.includes('登录') && document.querySelector('input[placeholder="请输入手机号"]') !== null,
        }
      })
      res.checks.diag = diag
      log('cards=' + diag.cards + ' topic=' + diag.topicLabel + ' word=' + diag.hasStudentWord)

      // ⑨ 多路投票（≥2票 PASS）
      let votes = 0, reasons = []
      if (diag.cards >= 3)       { votes++; reasons.push('cards[' + diag.cards + ']') }
      if (diag.topicLabel)       { votes++; reasons.push('topicLabel') }
      if (diag.hasStudentWord)   { votes++; reasons.push('exportWord') }
      if (diag.hasPdf)           { votes++; reasons.push('exportPdf') }
      if (diag.docHint)          { votes++; reasons.push('docHint') }
      res.checks.votes = votes
      res.checks.voteReasons = reasons
      res.checks.netOk = netOk
      res.checks.netStatus = netStatus
      res.checks.netLen = netLen
      res.checks.pageErrors = pe.length
      res.checks.consoleErrors = cerr.length

      // ⑩ 终判
      if (diag.failToast) {
        res.status = 'FAIL'
        res.verdicts.push('AI返回错误（出题失败toast）')
      } else if (diag.onLogin || bounced) {
        res.status = 'FAIL'
        res.verdicts.push('页面被重定向到登录页（401跳转/token失效）')
      } else if (votes >= 2 && netOk) {
        res.status = 'PASS'
        res.verdicts.push('渲染成功 ' + reasons.join(' + ') + ' 后端status=' + netStatus)
      } else if (votes >= 2 && !netOk) {
        res.status = 'WARN'
        res.verdicts.push('前渲染OK(' + reasons.join(' + ') + ') 但后端响应异常 status=' + netStatus + ' len=' + netLen)
      } else if (votes === 1) {
        res.status = 'WARN'
        res.verdicts.push('仅1信号(' + reasons[0] + ') 其余消失，需人工确认')
      } else {
        res.status = 'FAIL'
        res.verdicts.push('0渲染信号：流程通但题目未渲染到界面')
      }
      if (pe.length) res.verdicts.push('pageerror=' + pe.length)
      if (cerr.length) res.verdicts.push('consoleError=' + cerr.length)
    }
  } catch (e) {
    res.status = 'FAIL'
    res.verdicts.push('异常: ' + (e.message || e))
    res.checks.exception = (e.stack || e.message)
    log('EXCEPTION: ' + (e.stack || e.message))
  }

  const tag = res.status === 'PASS' ? 'pass' : 'fail'
  await page.screenshot({ path: path.join(SHOTS_DIR, 'vxg_' + tag + '.png') }).catch(() => {})
  await browser.close()
  emit(res, res.status === 'PASS' ? 0 : 1)
}

main().catch(e => {
  process.stdout.write(JSON.stringify({ status: 'FAIL', verdicts: ['FATAL ' + (e.message || e)] }) + '\n')
  process.stderr.write('FATAL: ' + (e.stack || e.message) + '\n')
  process.exit(1)
})
