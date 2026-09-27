// ⚠ 临时自检文件（验证 M7 静态门能否拦住"新加的假绿守卫"），验证完立即删除。
// 它故意写成历史假绿的形态：env 取样本、零样本不处理、打印 0 PASS/0 FAIL、exit 0。
const S = (process.env.IDS || '').split(',').filter(Boolean)
for (const i of S) { /* 不执行任何断言 */ }
console.log('0 PASS / 0 FAIL')
process.exit(0)
