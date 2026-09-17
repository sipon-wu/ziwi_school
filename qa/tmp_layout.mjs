/** 风格骨架对照：同一课题《观潮》分别用 china / tech 生成，验证「风格驱动骨架」（而非仅换色）。 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
import { markdownToStorybookH5 } from './dist-h5/courseware-h5.mjs'
const BASE = 'https://school1.ziwi.cn/api'
const THEME = { china: 'zgf-ink-wash', tech: 'te-quantum-blue' }

async function main() {
  const { token } = await (await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '13800000002', password: 'teacher123' }),
  })).json()
  const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

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
    const scenes = [...new Set([...md.matchAll(/<!--\s*layout:\s*(scene-[\w-]+)\s*-->/g)].map(m => m[1]))]
    const sks = [...new Set([...html.matchAll(/class="sk sk-([\w-]+)"/g)].map(m => m[1]))]
    const name = `观潮_风格对照_${style}`
    await fetch(`${BASE}/materials/json`, {
      method: 'POST', headers: H,
      body: JSON.stringify({
        name, type: 'courseware', format: 'h5', status: 'active', content: md, h5_html: html,
        subject: '语文', grade: '四年级', theme_id: THEME[style], color_root: colorRoot, tag: '语文四年级',
      }),
    })
    console.log(`\n[${style}] 已入库 "${name}"`)
    console.log(`  色相 ${j.color_palette?.hue ?? '-'} | 色调 ${j.color_palette?.tone_name ?? '-'}`)
    console.log(`  版式集合(${scenes.length}): ${scenes.join(', ')}`)
    console.log(`  渲染骨架: ${sks.length ? sks.join(', ') : '(无 sk-*)'} | 对话流页 ${html.match(/<div class="stage">/g)?.length || 0}`)
  }
  console.log('\nDONE')
}
main().catch(e => { console.error('ERR', e); process.exit(1) })
