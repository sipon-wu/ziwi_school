// 用系统 Chrome（executablePath）翻页截图已生成的 /tmp/preview_{china,tech}.html，验证风格骨架差异。
import fs from 'fs'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
let chromium = null, errs = []
for (const p of [
  '/Users/sipon/CodeBuddy/AI教案/qa/node_modules/playwright',
  '/Users/sipon/CodeBuddy/AI教案/code/frontend/node_modules/playwright',
  'playwright',
]) {
  try { chromium = require(p).chromium; if (chromium) break } catch (e) { errs.push(p + ':' + e.message.slice(0, 40)) }
}
if (!chromium) { console.log('NO_PW', errs.join(' | ')); process.exit(1) }

const EXE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const exe = fs.existsSync(EXE) ? EXE : undefined

for (const s of ['china', 'tech']) {
  const html = `/tmp/preview_${s}.html`
  if (!fs.existsSync(html)) { console.log(`[${s}] 缺 ${html}，先跑 verify_layout.mjs`); continue }
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--disable-gpu'] })
  const page = await browser.newPage({ viewport: { width: 960, height: 680 } })
  await page.goto('file://' + html)
  await page.waitForTimeout(500)
  for (let k = 0; k < 5; k++) {
    await page.screenshot({ path: `/tmp/shot_${s}_${k}.png` })
    await page.evaluate(() => { const n = document.querySelector('.next'); if (n) n.click() })
    await page.waitForTimeout(450)
  }
  await browser.close()
  console.log(`[${s}] 截图 /tmp/shot_${s}_0..4.png 完成`)
}
console.log('SHOTS_DONE')
