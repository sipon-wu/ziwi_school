const { chromium } = require('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://school1.ziwi.cn/login', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await p.fill('input[placeholder="请输入手机号"]', '13800000002');
  await p.fill('input[placeholder="请输入密码"]', 'teacher123');
  await p.click('button[type=submit]');
  await sleep(3000);
  await p.goto('http://school1.ziwi.cn/materials', { waitUntil: 'networkidle', timeout: 25000 }).catch(e => console.log('goto err', e.message));
  for (const t of [1000, 3000, 6000, 10000]) {
    await sleep(t === 1000 ? 1000 : t - (t === 3000 ? 1000 : t === 6000 ? 3000 : 6000));
    const txt = await p.evaluate(() => document.body ? document.body.innerText : '');
    console.log(`t=${t}ms len=${txt.length} head=${JSON.stringify(txt.slice(0,80))}`);
  }
  await b.close();
})();
