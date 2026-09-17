/**
 * rebuild-h5 —— 存量 H5 课件「重渲染 + 快照升级」脚本（2026-09-03）
 *
 * 背景：公开扫码/预览端点读的是发布时生成的 h5_html 快照；渲染器升级
 * （morph 形态字典 / v2 组件 / phenomenon 版式 / 真实 theme_id）不会自动进入快照。
 * 本脚本把每份「场景 markdown」课件用新引擎重渲染回填 h5_html（含真实 theme_id + color_root）。
 *
 * 依赖与运行：
 *   cd qa && npm init -y && npm i pg          # 一次性
 *   npm run build-lib                          # 或前端 npx vite build --config vite.lib.config.ts 产出 dist-h5/courseware-h5.mjs
 *   DATABASE_URL=postgresql://... node rebuild-h5.mjs              # 默认 DRY-RUN，只报告
 *   DATABASE_URL=... node rebuild-h5.mjs --apply --limit 20        # 真改（先看 dry-run）
 *   可选：--school <school_id> 只处理某校；--theme-map forest=night 不支持，主题保持库内 theme_id。
 *
 * 安全：默认只读；只有显式 --apply 才写库；每条渲染失败仅记录不中断。
 */
import { readFileSync } from 'node:fs'
import { mdToStory, buildStoryH5 } from './dist-h5/courseware-h5.mjs'
import pg from 'pg'

const apply = process.argv.includes('--apply')
const force = process.argv.includes('--force')   // 连"已新引擎"快照也重渲染（形态表更新后全量刷新用）
const limitArg = process.argv.find(a => a.startsWith('--limit='))
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 0
const schoolArg = process.argv.find(a => a.startsWith('--school='))
const school = schoolArg ? schoolArg.split('=')[1] : ''

const DSN = process.env.DATABASE_URL
if (!DSN) { console.error('DATABASE_URL 未设置'); process.exit(1) }

const looksMd = (s) => {
  s = String(s || '').trim()
  if (!s || '[{'.includes(s[0])) return false
  return s.startsWith('# ') || s.includes('\n## ')
}

async function main() {
  const client = new pg.Client({ connectionString: DSN })
  await client.connect()
  const q = [
    "SELECT id, name, school_id, status, theme_id, color_root, content, h5_html",
    "FROM materials WHERE format='h5' AND (type='courseware' OR type IS NULL OR type='')",
    school ? `AND school_id = '${school}'` : '',
    limit ? `ORDER BY created_at ASC LIMIT ${limit}` : 'ORDER BY created_at ASC',
  ].filter(Boolean).join(' ')
  const { rows } = await client.query(q)

  let rerenderable = 0, needRebuild = 0, updated = 0, failed = 0, alreadyNew = 0
  for (const r of rows) {
    if (!looksMd(r.content)) continue
    rerenderable++
    // 已是新引擎快照（含 morph 标记）则跳过（--force 时全量刷新）
    if (!force && String(r.h5_html || '').includes('morph-')) { alreadyNew++; continue }
    needRebuild++
    try {
      const themeId = r.theme_id || 'storybook'
      const story = mdToStory(String(r.content), { title: r.name || '', themeId })
      if (r.color_root) story.colorRoot = r.color_root
      const html = buildStoryH5(story)
      if (!html.includes('morph-')) { failed++; console.log(`  [warn] ${r.id} 渲染产物缺 morph 标记`); continue }
      if (apply) {
        await client.query("UPDATE materials SET h5_html=$1, updated_at=now() WHERE id=$2", [html, r.id])
        updated++
      }
    } catch (e) {
      failed++
      console.log(`  [err] ${r.id} ${(r.name || '').slice(0, 24)}: ${String(e).slice(0, 120)}`)
    }
  }
  await client.end()

  console.log(`\n总 H5 courseware：${rows.length}`)
  console.log(`可重渲染(scene md)：${rerenderable}（新引擎快照 ${alreadyNew} 份无需处理）`)
  console.log(`待重建旧/空快照：${needRebuild}；渲染失败：${failed}`)
  console.log(apply ? `已应用更新：${updated}` : 'DRY-RUN：未写库（加 --apply 生效）')
}

main().catch(e => { console.error(e); process.exit(1) })
