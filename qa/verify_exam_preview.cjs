/**
 * 验证试卷 A3 横排预览（ExamPreview 组件）staging · 13800000002
 * 流程: API 创建带题目的试卷 → 试卷库查看 → 点预览 → 验证渲染
 * 使用: node qa/verify_exam_preview.cjs
 */
const { chromium } = require('playwright');
const BASE = 'http://school1.ziwi.cn';

async function login(page) {
  const resp = await page.evaluate(async () => {
    const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: '13800000002', password: 'teacher123' }) });
    return await r.json();
  });
  await page.evaluate(t => localStorage.setItem('zhiwei_token', t), resp.token);
  return resp.token;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  let pass = 0, fail = 0;
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) });

  try {
    await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
    const token = await login(page);
    console.log('已登录');

    // 1. API 创建一套含多题型的试卷
    const questions = [
      { stem: '下列加点字注音完全正确的是？', type: 'choice', options: 'A.\nB.\nC.\nD.', answer: 'A', sort: 1, score: 3 },
      { stem: '"但愿人长久，千里共婵娟"的作者是？', type: 'choice', options: '李白\n杜甫\n苏轼\n辛弃疾', answer: '苏轼', sort: 2, score: 3 },
      { stem: '在横线上填写合适的词语', type: 'fill', options: '', answer: '示例', sort: 3, score: 4 },
      { stem: '判断正误：三角形内角和等于180°。()', type: 'judge', options: '', answer: '正确', sort: 4, score: 2 },
      { stem: '判断正误：平行四边形的对角线相等。()', type: 'judge', options: '', answer: '错误', sort: 5, score: 2 },
      { stem: '简述光合作用的过程。', type: 'short_answer', options: '', answer: '光合作用是绿色植物利用光能，将二氧化碳和水转化为有机物，并释放氧气的过程。', sort: 6, score: 6 },
    ];

    const created = await page.evaluate(async ({ token, questions }) => {
      const r = await fetch('/api/exams', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ title: 'A3双排验证卷', subject: '语文', grade: '四年级', questions: JSON.stringify(questions), total_score: 20, duration_minutes: 20, status: 'published' }),
      });
      return { status: r.status, body: await r.json() };
    }, { token, questions });
    if (created.status !== 201) {
      console.error('创建试卷失败:', created);
      fail++;
    } else {
      console.log('试卷已创建:', created.body.id);

      // 2. 进入试卷库
      await page.goto(BASE + '/exams', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // 3. 点击预览（Eye 按钮 or 行点击）
      const eyeBtn = page.locator('button[title="预览"]').first();
      if (await eyeBtn.isVisible().catch(() => false)) {
        await eyeBtn.click();
      } else {
        // Fallback: row click
        const row = page.locator('tbody tr').first();
        if (await row.isVisible().catch(() => false)) await row.click();
      }
      await page.waitForTimeout(3000);

      // 4. 检查 ExamPreview modal
      const modal = page.locator('.fixed.inset-0.z-\\[70\\]');
      const modalCount = await modal.count();
      if (modalCount === 0) {
        console.error('✗ ExamPreview modal 未打开');
        fail++;
      } else {
        console.log('ExamPreview modal 已打开, pass+1');
        pass++; // modal opened

        // 5. 验证中折虚线存在
        const divider = modal.locator('.border-dashed');
        const divCount = await divider.count();
        if (divCount > 0) {
          console.log('   ✓ 中折虚线存在, pass+1');
          pass++;
        } else {
          console.log('   ✗ 中折虚线未找到');
          fail++;
        }

        // 6. 验证 A3 画布渲染
        const canvas = modal.locator('[style*="aspect"]');
        const canvasCount = await canvas.count();
        if (canvasCount > 0) {
          console.log(`   ✓ A3 画布存在 (${canvasCount} 张), pass+1`);
          pass++;
        } else {
          console.log('   ✗ A3 画布未找到');
          fail++;
        }

        // 7. 验证底部导航（正面/背面切换 + 导出按钮）
        const nav = modal.locator('.shrink-0');
        const navCount = await nav.count();
        if (navCount > 0) {
          console.log('   ✓ 底部导航存在, pass+1');
          pass++;
        } else {
          console.log('   ✗ 底部导航不存在');
          fail++;
        }

        // 8. 验证缩放按钮
        const zoomBtn = modal.locator('button:has-text("100%")').first();
        if (await zoomBtn.isVisible().catch(() => false)) {
          console.log('   ✓ 缩放按钮存在, pass+1');
          pass++;
        } else {
          console.log('   ✗ 缩放按钮不存在');
          fail++;
        }

        // 9. 验证学生/教师卷切换按钮
        const viewBtn = modal.locator('button:has-text("学生卷"), button:has-text("教师卷")').first();
        if (await viewBtn.isVisible().catch(() => false)) {
          console.log('   ✓ 学生/教师卷切换按钮存在, pass+1');
          pass++;
        } else {
          console.log('   ✗ 视图切换按钮不存在');
          fail++;
        }

        // 10. 验证导出 Word 按钮
        const exportBtn = modal.locator('button:has-text("导出 Word")').first();
        if (await exportBtn.isVisible().catch(() => false)) {
          console.log('   ✓ 导出 Word 按钮存在, pass+1');
          pass++;
        } else {
          console.log('   ✗ 导出 Word 按钮不存在');
          fail++;
        }

        // 11. 验证题目渲染（至少应显示题干文本）
        const questionText = modal.locator('text=下列加点字注音完全正确的是？');
        if (await questionText.isVisible().catch(() => false)) {
          console.log('   ✓ 题目内容已渲染, pass+1');
          pass++;
        } else {
          console.log('   ✗ 题目未渲染');
          fail++;
        }

        // 截图
        await page.screenshot({ path: '/tmp/exam_preview_debug.png' });
        console.log('   截图: /tmp/exam_preview_debug.png');

        // 12. 验证正面/背面切换
        const backBtn = modal.locator('button:has-text("背面")').first();
        if (await backBtn.isVisible().catch(() => false)) {
          await backBtn.click();
          await page.waitForTimeout(500);
          console.log('   ✓ 正面/背面切换成功, pass+1');
          pass++;
        } else {
          console.log('   ✗ 背面切换按钮不存在');
          fail++;
        }
      }
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
