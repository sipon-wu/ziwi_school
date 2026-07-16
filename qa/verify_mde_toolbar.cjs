const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://school1.ziwi.cn';
const PHONE = process.env.PHONE || '13800000002';
const PASS = process.env.PASS || 'teacher123';
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', e => console.log('PE:', e.message));

  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
  const resp = await page.evaluate(async ({ phone, password }) => {
    const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, password }) });
    return await r.json();
  }, { phone: PHONE, password: PASS });
  await page.evaluate(t => localStorage.setItem('zhiwei_token', t), resp.token);

  await page.goto(BASE + '/lesson-plans/new', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // 切到文档模式
  const docTab = page.locator('button:has-text("文档模式")').first();
  if (await docTab.isVisible().catch(() => false)) await docTab.click();
  await page.waitForTimeout(2000);

  // 列出所有工具栏按钮的 title
  const titles = await page.evaluate(() => {
    const buttons = document.querySelectorAll('.w-md-editor [aria-label]');
    return Array.from(buttons).map(b => ({
      aria: b.getAttribute('aria-label'),
      title: b.getAttribute('title'),
    }));
  });
  console.log('工具栏按钮:');
  titles.forEach((t, i) => console.log(`  ${i + 1}. aria=${t.aria}  title=${t.title}`));

  // 验证：1) fullscreen 不存在  2) 中文 title
  const hasFullscreen = titles.some(t => t.title?.includes('全屏'));
  const hasChinese = titles.some(t => t.title && /[\u4e00-\u9fa5]/.test(t.title));
  console.log(`\nfullscreen 已隐藏: ${!hasFullscreen ? '✓' : '✗'}`);
  console.log(`中文 title 注入: ${hasChinese ? '✓' : '✗'}`);

  await page.screenshot({ path: '/tmp/mde_toolbar.png' });
  await browser.close();
})();
