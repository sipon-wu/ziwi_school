// 扫描所有页面上的可交互元素（button/input/select/a/textarea）
// 输出每个页面的元素清单，供后续编写全覆盖点击测试使用
const { chromium } = require('playwright')
const BASE = 'http://school1.ziwi.cn'
const sleep = ms => new Promise(r => setTimeout(r, ms))

const PAGES = [
  { label: '工作台', path: '/teacher' },
  { label: '出题列表', path: '/exercises' },
  { label: '出题新建', path: '/exercises/new' },
  { label: '教案列表', path: '/lesson-plans' },
  { label: '教案新建', path: '/lesson-plans/new' },
  { label: '素材库', path: '/materials' },
  { label: '试卷库', path: '/exams' },
  { label: '组卷新建', path: '/exams/new' },
  { label: '作业列表', path: '/assignments' },
  { label: '作业布置', path: '/assignments/new' },
  { label: '学情分析', path: '/analytics' },
  { label: '批阅', path: '/grading' },
  { label: '成长足迹', path: '/growth' },
  { label: '关爱', path: '/care' },
  { label: '家长签字', path: '/parent-sign' },
  { label: '教案发布库', path: '/published-lessons' },
  { label: '教案互审', path: '/review-pool' },
  { label: '班级切换', path: '/classes' },
  { label: '系统设置', path: '/settings' },
  { label: 'IT管理', path: '/it-admin' },
  { label: '校长', path: '/principal' },
]

;(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] })
  const p = await b.newPage({ ignoreHTTPSErrors: true })

  // 登录
  await p.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  await p.fill('input[placeholder="请输入手机号"]', '13800000002')
  await p.fill('input[placeholder="请输入密码"]', 'teacher123')
  await p.click('button[type=submit]')
  await sleep(2000)

  const report = {}
  for (const { label, path } of PAGES) {
    try {
      await p.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 20000 })
      await sleep(2500)
    } catch { /* skip */ }

    const elements = await p.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button')).map(b => ({
        type: 'button',
        text: (b.textContent || '').trim().slice(0, 60),
        title: b.title || '',
        disabled: b.disabled || false,
        className: b.className.slice(0, 40),
      })).filter(b => b.text || b.title)

      const inputs = Array.from(document.querySelectorAll('input:not([type=hidden])')).map(i => ({
        type: 'input[' + (i.type || 'text') + ']',
        placeholder: i.placeholder || '',
        disabled: i.disabled || false,
        value: i.value?.slice(0, 30) || '',
      })).filter(i => i.placeholder)

      const selects = Array.from(document.querySelectorAll('select')).map(s => ({
        type: 'select',
        options: Array.from(s.options).slice(0, 8).map(o => o.text),
      })).filter(s => s.options.length)

      const anchors = Array.from(document.querySelectorAll('a[href]')).map(a => ({
        type: 'a',
        text: (a.textContent || '').trim().slice(0, 40),
        href: a.getAttribute('href')?.slice(0, 60) || '',
      })).filter(a => a.text && !a.href.startsWith('#'))

      return [...buttons, ...inputs, ...selects, ...anchors]
    })

    report[label] = { path, elements, bodyLen: await p.evaluate(() => document.body.innerText.length) }
    console.log(`\n[${label}] ${path} — ${elements.length}个交互元素, bodyLen=${report[label].bodyLen}`)
    const btns = elements.filter(e => e.type === 'button')
    console.log('  按钮:', btns.map(b => (b.disabled ? '[DIS]' : '') + b.text + (b.title ? ` (title:${b.title})` : '')).join(' | ').slice(0, 300))
    console.log('  输入框:', elements.filter(e => e.type.startsWith('input')).map(i => i.placeholder).join(' | ').slice(0, 200))
    console.log('  链接:', elements.filter(e => e.type === 'a').map(a => a.text + '→' + a.href).join(' | ').slice(0, 200))
  }

  await b.close()
  require('fs').writeFileSync(require('path').join(__dirname, 'scan_report.json'), JSON.stringify(report, null, 2))
  console.log('\n报告已写入 scan_report.json')
})().catch(e => { console.error('ERR', e); process.exit(1) })
