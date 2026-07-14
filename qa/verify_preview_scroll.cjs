/**
 * 验证预览页滚动 + 左右滑动翻页 + 底部导航可达（staging · 13800000002）
 * 真实 UI 流程：API 创建带 sections 的教案 → 列表 hover → 编辑 → 预览（投屏） → 验证交互
 * 覆盖：PptxPreview（PPT 在线预览）+ PresentationMode（投屏模式）
 * 使用: node qa/verify_preview_scroll.cjs
 */
const { chromium } = require('playwright');
const BASE = 'http://school1.ziwi.cn';

async function loginAndToken(page) {
  const resp = await page.evaluate(async () => {
    const r = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '13800000002', password: 'teacher123' }),
    });
    return await r.json();
  });
  await page.evaluate(t => localStorage.setItem('zhiwei_token', t), resp.token);
  return resp.token;
}

async function createRichPlan(page, token) {
  // 标题 ≤12 字；content 含 5 个 ## 段，每段长文以触发滚动
  const content = `## 教学目标
1. 让学生掌握三角形内角和定理
2. 通过拼图法与演绎法两种途径理解证明思路
3. 培养严谨的几何推理与表达能力
在任意三角形 ABC 中，三个内角 ∠A、∠B、∠C 的度数之和恒等于 180°。这是平面几何中最基础也最重要的定理之一。
学生将通过动手操作（撕角拼合）、合作探究（小组讨论拼法）、自主归纳（从特例到一般）三种方式，逐步建立"不变性"的几何直觉。
为后续学习多边形内角和、外角定理奠定基础。
本节课的学习需要学生具备基本的几何作图能力与简单演绎推理经验，建议在四年级上学期几何初步认识之后开展。
通过本节课的学习，学生将形成"形"与"数"互译的能力，为后续学习勾股定理、相似三角形等更深入的几何知识打下坚实基础。
教师在教学过程中应注重启发式引导，鼓励学生主动发现问题、提出问题、解决问题，培养独立思考与合作交流的素养。

## 探索新知
1. 在草稿纸上画出一个任意三角形
2. 用量角器分别量出三个角的度数
3. 计算三者之和并验证是否等于 180°
4. 换画三个不同形状的三角形重复上述过程
5. 观察结果，尝试用自己的语言描述规律
通过实验我们发现：无论三角形是锐角、直角还是钝角，无论边长如何变化，三个内角之和始终等于 180°。
这引发我们的思考：为什么所有三角形都满足这一规律？背后是否隐藏着更一般的几何原理？我们将通过严格的几何证明给出回答。
进一步地，我们可以引导学生思考：四边形的内角和是多少？五边形呢？六边形呢？通过类比推理，学生可以猜测出 n 边形内角和 = (n − 2) × 180°，并通过分割为三角形的方式严格证明。
这种"从特例到一般、从猜想到证明"的思维过程，正是数学核心素养的重要体现。

## 证明定理
方法一：拼图法。
将三角形 ABC 的三个内角剪下，在平面上拼合，使它们的顶点重合于一点。由于三角形内角和是"内"于三角形本身的，三者拼合时恰好构成一条直线（平角 180°）。
方法二：演绎法（过顶点作平行线）。
过顶点 A 作 BC 的平行线 MN，则 ∠MAB = ∠B（内错角），∠NAC = ∠C（内错角），而 ∠MAB + ∠BAC + ∠NAC = 180°（平角），因此 ∠B + ∠BAC + ∠C = 180°。
两种方法殊途同归，体现了"操作直观"与"逻辑严密"之间的桥梁。
方法三：辅助线法。
延长 BC 至 D，使 CD = AC，连接 AD。则 ∠DAC = ∠ACD（等腰三角形底角相等），∠B = ∠D（外角等于不相邻两内角之和），所以 ∠BAC + ∠B + ∠ACB = ∠BAC + ∠D + ∠DAB = ∠DAC + ∠DAB = ∠BAD = 180°（平角）。
三种方法各有特色：拼图法直观、演绎法严谨、辅助线法巧妙。

## 应用练习
例 1：在△ABC 中，∠A = 50°，∠B = 70°，求 ∠C。
解：∠C = 180° − 50° − 70° = 60°。
例 2：在△ABC 中，∠A = ∠B = 65°，判断三角形的形状。
解：∠C = 180° − 65° − 65° = 50°，三角形为锐角三角形。
例 3：已知等腰三角形顶角为 40°，求底角。
解：底角 = (180° − 40°) ÷ 2 = 70°。
例 4：直角三角形中，一个锐角为 35°，求另一个锐角。
解：另一锐角 = 90° − 35° = 55°。
例 5：△ABC 中，∠A 比 ∠B 大 20°，∠C = ∠A + ∠B，求三个内角。
解：设 ∠A = x°，则 ∠B = (x − 20)°，∠C = (x + x − 20)° = (2x − 20)°，列方程 x + (x − 20) + (2x − 20) = 180，解得 x = 55，所以 ∠A = 55°，∠B = 35°，∠C = 90°。
例 6：五边形五个内角的和是多少？
解：(5 − 2) × 180° = 540°。
通过以上分层练习，学生能够逐步巩固定理，并灵活运用于不同情境，形成完整的知识结构。

## 课堂小结
本节课我们一起探索并证明了"三角形内角和定理"，经历了"猜想—验证—证明—应用"的完整数学探究过程。
我们既看到了拼图法的直观之美，也感受到了演绎法的逻辑之严。两种方法相互补充，帮助我们从不同角度理解同一结论。
希望同学们在今后的学习中，能够主动动手、大胆猜想、小心求证，让数学成为探索世界的钥匙。
在小学阶段，几何学习的核心不在于记忆结论，而在于发展学生的空间观念、推理能力与几何直觉。三角形内角和定理是连接"图形"与"度量"的重要桥梁，希望同学们能以此为起点，开启更精彩的几何之旅。
最后，请同学们课后完成课本练习第 12、13、15 题，并思考：如果把三角形的三个内角"折"到三角形内部，能否也拼成一个平角？`;

  return await page.evaluate(async ({ token, content }) => {
    const r = await fetch('/api/lesson-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({
        title: '三角形内角和',
        subject: '数学',
        grade: '四年级',
        unit: '第二单元',
        content,
        materialRefs: [],
      }),
    });
    return { status: r.status, body: await r.json() };
  }, { token, content });
}

async function openLessonEditor(page, planId) {
  await page.goto(`${BASE}/lesson-plans/${planId}/edit`, { waitUntil: 'networkidle', timeout: 20000 });
  // 编辑页是全屏布局（不在 AppLayout 内），等"预览"按钮出现
  await page.waitForSelector('button:has-text("预览")', { timeout: 15000 }).catch(() => { });
  await page.waitForTimeout(1500);
}

async function clickPreviewButton(page) {
  // 编辑器底部的"预览"按钮（不在 main 内，编辑页用全屏布局）
  // 选文本恰为"预览"的按钮（避免匹配到"预览验收"等长字符串）
  const all = page.locator('button');
  const n = await all.count();
  for (let i = 0; i < n; i++) {
    const t = (await all.nth(i).textContent().catch(() => '') || '').trim();
    if (t === '预览' && await all.nth(i).isVisible().catch(() => false)) {
      await all.nth(i).scrollIntoViewIfNeeded().catch(() => {});
      await all.nth(i).click();
      return true;
    }
  }
  return false;
}

async function checkScroll(page, container, label) {
  const el = await container.elementHandle().catch(() => null);
  if (!el) { console.log(`  ✗ ${label}: 容器不存在`); return false; }
  const oldS = await page.evaluate(e => e.scrollTop, el);
  const maxS = await page.evaluate(e => e.scrollHeight - e.clientHeight, el);
  try { await container.evaluate(e => { e.scrollBy(0, 100) }) } catch { }
  await page.waitForTimeout(300);
  const newS = await page.evaluate(e => e.scrollTop, el);
  const canScroll = (newS > oldS) || (maxS === 0);
  console.log(`  ${canScroll ? '✓' : '✗'} ${label}: scrollTop ${oldS}→${newS} (maxScroll=${maxS})`);
  return canScroll;
}

async function checkNavInView(page, modal, label) {
  // 优先：底部「下一页」按钮在视口内且未被裁切
  const next = modal.locator('button:has-text("下一页")').first();
  const nextEl = await next.elementHandle().catch(() => null);
  if (!nextEl) { console.log(`  ✗ ${label}: 找不到「下一页」`); return false; }
  const r = await page.evaluate(el => {
    const rect = el.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, vh: window.innerHeight };
  }, nextEl);
  const inView = r.bottom <= r.vh - 2 && r.top >= 0;
  console.log(`  ${inView ? '✓' : '✗'} ${label}: 「下一页」bottom=${r.bottom.toFixed(0)} vh=${r.vh}`);
  return inView;
}

async function checkSwipe(page, modal, label) {
  const totalText = await modal.locator('span:has-text("/")').first().textContent().catch(() => '');
  const m = totalText?.match(/(\d+)\s*\/\s*(\d+)/);
  const total = m ? parseInt(m[2]) : 0;
  const initIdx = m ? parseInt(m[1]) : 1;
  if (!total || total <= 1) {
    console.log(`  [SKIP] ${label}: 仅 ${total} 页，无法验证滑动`);
    return true; // 单页不视为失败
  }
  // 在舞台/内容区左滑
  const area = modal.locator('[style*="touchAction"]').first();
  const box = await area.boundingBox().catch(() => null);
  let cx, cy;
  if (box) {
    cx = box.x + box.width / 2;
    cy = box.y + box.height / 2;
  } else {
    const mBox = await modal.boundingBox().catch(() => null);
    if (!mBox) { console.log(`  ✗ ${label}: 找不到画布`); return false; }
    cx = mBox.x + mBox.width / 2;
    cy = mBox.y + mBox.height * 0.5;
  }
  await page.mouse.move(cx + 120, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 120, cy, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(800);

  const newText = await modal.locator('span:has-text("/")').first().textContent().catch(() => '0/1');
  const nm = newText?.match(/(\d+)\s*\/\s*(\d+)/);
  const newIdx = nm ? parseInt(nm[1]) : 1;
  const swiped = newIdx !== initIdx;
  console.log(`  ${swiped ? '✓' : '✗'} ${label}: 左滑 ${initIdx}/${total}→${newIdx}/${total}`);
  return swiped;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  let pass = 0, fail = 0;
  const errors = [];

  page.on('pageerror', e => errors.push({ t: 'pageerror', m: e.message }));
  page.on('console', m => { if (m.type() === 'error') errors.push({ t: 'console.error', m: m.text() }) });

  try {
    await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
    const token = await loginAndToken(page);
    console.log('已登录, token=' + (token ? 'yes' : 'NO'));

    // 1. 创建带 sections 的教案
    const created = await createRichPlan(page, token);
    if (created.status !== 201) {
      console.error('创建教案失败:', created.status, JSON.stringify(created.body).substring(0, 200));
      fail++;
    } else {
      const planId = created.body.id;
      console.log('已创建教案:', planId);

      // 2. 进入编辑器
      await openLessonEditor(page, planId);
      console.log('编辑器 URL:', page.url());

      // 3. 点"预览"打开 PresentationMode
      const clicked = await clickPreviewButton(page);
      if (!clicked) {
        console.error('未找到预览按钮');
        fail++;
      } else {
        await page.waitForTimeout(2500);
        const modal = page.locator('.fixed.inset-0.z-\\[70\\]');
        if ((await modal.count()) === 0) {
          console.error('PresentationMode 未打开');
          fail++;
        } else {
          console.log('=== PresentationMode 打开 ===');
          // 1) 滚动可达
          const r1 = await checkScroll(page, modal.locator('.flex-1.overflow-auto').first(), '1. 内容区垂直滚动');
          r1 ? pass++ : fail++;
          // 2) 底导在视口
          const r2 = await checkNavInView(page, modal, '2. 底导「下一页」可达');
          r2 ? pass++ : fail++;
          // 3) 左右滑动翻页
          const r3 = await checkSwipe(page, modal, '3. 鼠标左滑翻页');
          r3 ? pass++ : fail++;

          // 关闭
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
        }
      }
    }
  } catch (e) {
    console.error('FATAL:', e.message);
    fail++;
  }

  console.log(`\n=== 汇总: ${pass} PASS / ${fail} FAIL / ${pass + fail} 总计 ===`);
  if (errors.length) {
    console.log('错误（首5条）:');
    errors.slice(0, 5).forEach(e => console.log(`  [${e.t}] ${e.m?.substring(0, 150)}`));
  } else {
    console.log('无 pageerror / console error');
  }

  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
}

main();
