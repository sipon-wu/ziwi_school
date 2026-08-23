#!/usr/bin/env node
/**
 * ICP 备案号一致性校验（防复发）
 * 根因：曾因手敲把"渝"误作"蜀"、号码尾段漏位。
 * 本脚本断言全仓库 ICP 号必须 === 单一真相源（cloud 项目 README 第七节 / 前端 src/lib/site.ts）。
 * 用法：node qa/check_icp_beian.cjs
 * 退出码 0=通过，1=发现不一致（列出违规文件与行号）。
 */
const fs = require('fs')
const path = require('path')

const TRUTH = '渝ICP备2026009247号'
const ROOT = path.resolve(__dirname, '..')
// 跳过无需检查的目录
const SKIP = new Set(['node_modules', '.git', 'dist', 'qa/downloads', '产品规划/二期设计稿'])

const violations = []

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      const rel = path.relative(ROOT, full)
      if (SKIP.has(ent.name) || SKIP.has(rel)) continue
      walk(full)
    } else if (ent.isFile()) {
      const ext = path.extname(ent.name).toLowerCase()
      if (!['.ts', '.tsx', '.js', '.jsx', '.md', '.html', '.json', '.txt'].includes(ext)) continue
      const content = fs.readFileSync(full, 'utf8')
      const lines = content.split('\n')
      lines.forEach((line, i) => {
        // 匹配任意 ICP 备案号形态：X ICP备XXXXXXXXXXX号
        const m = line.match(/[一-龥]?ICP备\d{8,13}号/)
        if (m) {
          const found = m[0]
          if (found !== TRUTH) {
            violations.push({ file: path.relative(ROOT, full), line: i + 1, found })
          }
        }
      })
    }
  }
}

walk(ROOT)

if (violations.length) {
  console.error(`✗ ICP 备案号不一致，必须全部等于 "${TRUTH}"：`)
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  发现 "${v.found}"`)
  }
  process.exit(1)
} else {
  console.log(`✓ 全仓库 ICP 备案号一致 = "${TRUTH}"`)
  process.exit(0)
}
