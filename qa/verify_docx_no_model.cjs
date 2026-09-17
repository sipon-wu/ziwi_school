// 自证：教案 Word 导出里**不再出现内部配方**（生成模型 / qwen-plus / 发散边界 / 前置来源）2026-09-15
// 做法：把 exportDocx 打包成浏览器可用的 IIFE → 在真实页面里调用 → 取回 docx 字节 → 解开 zip 读 document.xml 文本
const { execFileSync } = require('child_process')
const { chromium } = require('playwright')
const fs = require('fs')
const FE = '/Users/sipon/CodeBuddy/AI教案/code/frontend'
const log = (...a) => console.log(...a)

;(async () => {
  execFileSync('npx', ['esbuild', 'src/lib/exportDocx.ts', '--bundle', '--format=iife', '--global-name=ExpDocx',
    '--alias:@shared=../shared', '--outfile=/tmp/expdocx.iife.js', '--log-level=error'], { cwd: FE, stdio: 'inherit' })

  const br = await chromium.launch()
  const p = await br.newPage()
  await p.goto('http://school1.ziwi.cn/login', { waitUntil: 'domcontentloaded' })
  await p.addScriptTag({ path: '/tmp/expdocx.iife.js' })
  const b64 = await p.evaluate(async () => {
    const blob = await window.ExpDocx.exportLessonPlanToDocx('# 一、教学目标\n1. 认识生字，会写"潮"。\n2. 有感情地朗读课文。\n', {
      subject: '语文', grade: '四年级', title: '观潮 09-15',
      textbookUnit: '统编版 · 第一单元', period: 1, model: 'qwen-plus', date: '2026/9/15',
    })
    const bytes = new Uint8Array(await blob.arrayBuffer())
    let s = ''
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
    return btoa(s)
  })
  await br.close()

  fs.writeFileSync('/tmp/plan_check.docx', Buffer.from(b64, 'base64'))
  const xml = execFileSync('unzip', ['-p', '/tmp/plan_check.docx', 'word/document.xml']).toString('utf8')
  const txt = xml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  const hits = ['生成模型', 'qwen', '发散边界', '前置来源', '知识面来源'].filter(k => txt.includes(k))
  log('docx 字节数=' + Buffer.from(b64, 'base64').length)
  log('可见文本（前 160 字）：' + txt.slice(0, 160))
  log(hits.length === 0 ? '内部配方字段：无 ✔ 通过' : '仍含内部字段：' + hits.join(' / ') + ' ✘ 未通过')
  fs.rmSync('/tmp/plan_check.docx', { force: true }); fs.rmSync('/tmp/expdocx.iife.js', { force: true })
  process.exit(hits.length === 0 ? 0 : 2)
})().catch(e => { console.error('FAIL:', e.message); process.exit(3) })
