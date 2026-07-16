const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', e => console.log('PE:', e.message));

  await page.goto('http://school1.ziwi.cn/login', { waitUntil: 'domcontentloaded' });
  const resp = await page.evaluate(async () => {
    const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: '13800000002', password: 'teacher123' }) });
    return await r.json();
  });
  await page.evaluate(t => localStorage.setItem('zhiwei_token', t), resp.token);

  await page.goto('http://school1.ziwi.cn/lesson-plans/new', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  const docTab = page.locator('button:has-text("文档模式")').first();
  if (await docTab.isVisible().catch(() => false)) await docTab.click();
  await page.waitForTimeout(2000);

  // 点击数学式工具栏
  const mathBtn = page.locator('img[src*="icon-math"]').first();
  if (await mathBtn.isVisible().catch(() => false)) {
    await mathBtn.click();
    await page.waitForTimeout(1000);
    // 输入 LaTeX 并插入
    const latex = '\\frac{a}{b} + \\sqrt{x}';
    const ta = page.locator('textarea').first();
    await ta.fill(latex);
    await page.click('button:has-text("插入到文档")');
    await page.waitForTimeout(1000);
  }

  // 检查公式渲染
  const info = await page.evaluate(() => {
    const formulaBoxes = document.querySelectorAll('.formula-box-container');
    const katexRendered = document.querySelectorAll('.formula-box-container .katex');
    const katexHtml = document.querySelectorAll('.formula-box-container .katex-html');
    return {
      formulaBoxCount: formulaBoxes.length,
      katexInsideCount: katexRendered.length,
      katexHtmlCount: katexHtml.length,
      firstBoxHTML: formulaBoxes[0]?.innerHTML.substring(0, 200) || '',
    };
  });
  console.log('Formula rendering:', JSON.stringify(info, null, 2));

  await page.screenshot({ path: '/tmp/formula_v2.png' });
  console.log('screenshot saved');
  await browser.close();
})();
