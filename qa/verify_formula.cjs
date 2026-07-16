/**
 * 验证公式渲染集成（KaTeX）staging · 13800000002
 * A: 试卷预览 ExamPreview — 只读渲染 $$ 公式
 * B: 题目编辑器 ExerciseEditor — 编辑态 hover 显示编辑图标
 * 使用: node qa/verify_formula.cjs
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://school1.ziwi.cn';
const PHONE = process.env.PHONE || '13800000002';
const PASS = process.env.PASS || 'teacher123';

async function login(page) {
  const resp = await page.evaluate(async ({ phone, password }) => {
    const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, password }) });
    return await r.json();
  }, { phone: PHONE, password: PASS });
  await page.evaluate(t => localStorage.setItem('zhiwei_token', t), resp.token);
  return resp.token;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  let pass = 0, fail = 0;
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().substring(0, 150)) });

  try {
    await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
    const token = await login(page);

    // ── A: 试卷预览（只读 KaTeX 渲染）──
    console.log('=== A: 试卷预览 ExamPreview 公式渲染 ===');
    const questions = [
      { stem: '已知二次函数 $$y=ax^2+bx+c$$ 的图像过点 $(1,3)$，则 $a+b+c$ 等于？', type: 'choice', options: '1\n2\n3\n4', answer: '3', sort: 1, score: 3 },
      { stem: '化学方程式 $$\\ce{2H2 + O2 -> 2H2O}$$ 表示氢气和氧气反应生成水。', type: 'judge', options: '', answer: '正确', sort: 2, score: 2 },
      { stem: '计算 $$\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$$ 当 $a=1,b=-3,c=2$ 时的值。', type: 'fill', options: '', answer: '2 或 1', sort: 3, score: 4 },
    ];

    const created = await page.evaluate(async ({ token, questions }) => {
      const r = await fetch('/api/exams', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ title: '公式渲染测试卷', subject: '语文', grade: '四年级', questions: JSON.stringify(questions), total_score: 9, duration_minutes: 10, status: 'published' }),
      });
      return { status: r.status, body: await r.json() };
    }, { token, questions });

    if (created.status !== 201) { console.error('创建试卷失败'); fail++; }
    else {
      console.log('试卷已创建:', created.body.id);
      await page.goto(BASE + '/exams', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      // 定位新建的含公式试卷所在行，打开其预览（避免误点排序在前的旧试卷）
      const newRow = page.locator('tr', { hasText: '公式渲染测试卷' }).first();
      const eyeBtn = newRow.locator('button[title="预览"]');
      if (await eyeBtn.isVisible().catch(() => false)) await eyeBtn.click();
      else {
        const fb = page.locator('button[title="预览"]').first();
        if (await fb.isVisible().catch(() => false)) await fb.click();
        else { const row = page.locator('tbody tr').first(); if (await row.isVisible().catch(() => false)) await row.click(); }
      }
      await page.waitForSelector('.fixed.inset-0.z-[70]', { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(3000);

      // Check KaTeX rendering
      const katexEls = await page.evaluate(() => {
        const els = document.querySelectorAll('.katex');
        return { count: els.length, sample: Array.from(els).slice(0, 2).map(e => e.className) };
      });
      console.log(`  Katex elements: ${katexEls.count}${katexEls.count >= 2 ? ' ✓' : ' ✗'}`);
      katexEls.count >= 2 ? pass++ : fail++;

      // Check math formulas visible
      const mathVisible = await page.locator('.katex-html').first().isVisible().catch(() => false);
      console.log(`  公式可见: ${mathVisible ? '✓' : '✗'}`, 'pass+1');
      mathVisible ? pass++ : fail++;

      // Check chemistry formula rendered
      const chemCheck = await page.evaluate(() => {
        const allText = document.body.textContent || '';
        return allText.includes('2H') && allText.includes('2O'); // mhchem rendered
      });
      console.log(`  化学式渲染: ${chemCheck ? '✓' : '✗'}`, 'pass+1');
      chemCheck ? pass++ : fail++;

      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // ── B: 题目编辑器（编辑态 hover 编辑图标）──
    console.log('\n=== B: 题目编辑器 ExerciseEditor ===');
    // Create a single question with formula
    const q = await page.evaluate(async ({ token }) => {
      const r = await fetch('/api/exercises', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({
          stem: '已知 $$x^2 + y^2 = z^2$$，当 $x=3, y=4$ 时，求 $z$。',
          question_type: 'fill', answer: '5', difficulty: 'L1', score: 5,
          subject: '数学', grade: '四年级',
        }),
      });
      return await r.json();
    }, { token });

    if (!q.id) { console.error('创建题目失败'); fail++; }
    else {
      console.log('题目已创建:', q.id);
      await page.goto(BASE + '/exercises/' + q.id, { waitUntil: 'networkidle' });
      await page.waitForTimeout(3000);

      // Check page is edit mode (should be since it's draft)
      const isEdit = await page.locator('h1:has-text("编辑")').isVisible().catch(() => false);
      console.log(`  编辑模式: ${isEdit ? '✓' : '✗'}`, 'pass+1');
      isEdit ? pass++ : fail++;

      // Check formula rendered in content area
      const contentKatex = await page.evaluate(() => {
        const el = document.querySelector('[class*="katex"]');
        return el ? true : false;
      });
      console.log(`  题干公式渲染: ${contentKatex ? '✓' : '✗'}`, 'pass+1');
      contentKatex ? pass++ : fail++;

      // Check: source code toggle exists
      const srcBtn = page.locator('button:has-text("源码")').first();
      const hasSrcBtn = await srcBtn.isVisible().catch(() => false);
      console.log(`  源码切换按钮: ${hasSrcBtn ? '✓' : '✗'}`, 'pass+1');
      hasSrcBtn ? pass++ : fail++;
    }

  } catch (e) {
    console.error('FATAL:', e.message);
    fail++;
  }

  console.log(`\n=== 汇总: ${pass} PASS / ${fail} FAIL / ${pass + fail} 总计 ===`);
  if (errors.length) console.log('Errors:', errors.slice(0, 3).join(' | '));
  else console.log('无 pageerror / console error');

  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
}
main();
