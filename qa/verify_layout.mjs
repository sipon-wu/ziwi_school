// 风格骨架自测：同课题《观潮》用 china/tech 生成，验证 renderer 真正产出 layout 骨架类 + 截图。
import fs from 'fs'
import { createRequire } from 'module'

const DIST = '/Users/sipon/CodeBuddy/AI教案/qa/dist-h5/courseware-h5.mjs'
const TMP = '/Users/sipon/CodeBuddy/AI教案/qa/dist-h5-tmp/courseware-h5.mjs'
// 优先用刚构建的含 layout 骨架的新 mjs（TMP）；避免取到旧的 qa/dist-h5 产物导致漏掉 layout 类
const useMjs = fs.existsSync(TMP) ? TMP : DIST
const { markdownToStorybookH5 } = await import('file://' + useMjs)

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
const BASE = 'https://school1.ziwi.cn/api'
const THEME = { china: 'zgf-ink-wash', tech: 'te-quantum-blue' }

async function main() {
  const { token } = await (await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '13800000002', password: 'teacher123' }),
  })).json()
  const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  const require = createRequire(import.meta.url)
  let chromium = null
  try { chromium = require('/Users/sipon/CodeBuddy/AI教案/code/frontend/node_modules/playwright').chromium } catch (e) {}

  for (const style of ['china', 'tech']) {
    const r = await fetch(`${BASE}/ai/courseware/generate`, {
      method: 'POST', headers: H,
      body: JSON.stringify({
        subject: '语文', grade: '四年级', lesson_title: '观潮', content: '',
        school_id: 'sch-0001', textbook_version: '', selected_knowledge_ids: [],
        knowledge_points: [], prerequisite_points: [], curriculum_codes: [],
        divergence_level: 'standard', edge_enabled: false, edge_categories: [],
        style_tag: style, style_profile: '', style_mode: 'preset', format: 'h5',
      }),
    })
    const j = await r.json()
    const md = j.courseware_markdown || ''
    if (!md) { console.log(`[${style}] 生成失败`, JSON.stringify(j).slice(0, 120)); continue }
    const colorRoot = j.color_palette ? JSON.stringify(j.color_palette) : ''
    const html = markdownToStorybookH5(md, {
      subject: '语文', grade: '四年级', title: '观潮', teacherName: '李老师',
      themeId: THEME[style], colorRoot,
    })
    const cls = style === 'china' ? 'china' : 'tech'
    const hasLayout = html.includes(`layout-${cls}`)
    const hasBothCss = html.includes('.layout-tech') && html.includes('.layout-china')
    console.log(`\n[${style}] body 含 layout-${cls}: ${hasLayout} | CSS 含两风格骨架规则: ${hasBothCss}`)
    fs.writeFileSync(`/tmp/preview_${style}.html`, html)
    console.log(`  写 /tmp/preview_${style}.html (${html.length} bytes)`)
    if (chromium) {
      try {
        const browser = await chromium.launch()
        const page = await browser.newPage({ viewport: { width: 960, height: 660 } })
        for (let k = 0; k < 5; k++) {
          await page.goto('file:///tmp/preview_' + style + '.html')
          await page.waitForTimeout(300)
          for (let s = 0; s < k; s++) await page.evaluate(() => { const n = document.querySelector('.next'); if (n) n.click() })
          await page.waitForTimeout(300)
          await page.screenshot({ path: `/tmp/shot_${style}_${k}.png` })
        }
        await browser.close()
        console.log(`  [${style}] 截图 /tmp/shot_${style}_0..4.png`)
      } catch (e) { console.log(`  [${style}] 截图失败: ${String(e).slice(0, 100)}`) }
    } else {
      console.log(`  [${style}] 无 chromium，跳过截图（已生成 html 可人工打开）`)
    }
  }
  console.log('\nDONE')
}
main().catch(e => { console.error('ERR', e); process.exit(1) })
