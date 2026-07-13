// 后台等待覆盖生成完成，自动产出报告
const fs = require('fs')
const { execSync } = require('child_process')
const dir = __dirname
const sleep = ms => new Promise(r => setTimeout(r, ms))
const read = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return null } }

;(async () => {
  const deadline = Date.now() + 45 * 60 * 1000
  let stableCount = 0, lastCount = -1
  while (Date.now() < deadline) {
    const p = read(dir + '/coverage_progress.json') || {}
    const k = Object.keys(p)
    const all3 = k.filter(x => p[x].ok === 3).length
    if (all3 >= 81) { console.log('ALL 81 DONE'); break }
    // 进程可能已结束（队列空但仍有未达成）：进度文件不再变化则退出等待
    if (k.length === lastCount) { stableCount++; if (stableCount >= 8) { console.log('progress stable, stop waiting'); break } }
    else { stableCount = 0; lastCount = k.length }
    await sleep(15000)
  }
  try { execSync('node ' + dir + '/aggregate_report.js', { stdio: 'inherit' }) } catch (e) { console.log('aggregate err', e.message) }
  console.log('REPORT DONE')
})()
