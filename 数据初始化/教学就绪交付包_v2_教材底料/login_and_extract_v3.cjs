const { chromium } = require('D:/ziwi/dev_env/npm-global/node_modules/@playwright/cli/node_modules/playwright-core');
const fs = require('fs');
const path = require('path');

const CLASS_ACTIVITY_URL = 'https://basic.smartedu.cn/syncClassroom/classActivity?activityId=d00a983e-7f90-4b2c-a478-908232fd9fa8&chapterId=461ef893-0ca1-359e-af20-e799123042b2&teachingmaterialId=5ce96672-f52f-4c2f-9c3d-016ed1415278&fromPrepare=1';
const CHROME_EXE = 'C:\\Users\\Kane.liu\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe';
const OUT = path.join(__dirname, 'output');

const wait = ms => new Promise(r => setTimeout(r, ms));

// 判断当前页面是否需要登录（未登录）
// 信号：① URL 被重定向到 auth/login 页面；② 页面出现「需要登录」弹窗；③ 页面是纯登录表单（短文本+登录按钮）
async function needsLogin(page) {
  try {
    const url = page.url();
    if (url.includes('auth.smartedu') || url.includes('/uias/login') || url.includes('/uias/register')) return { needed: true, reason: 'URL-is-auth' };

    const info = await page.evaluate(() => ({
      text: document.body.innerText || '',
      url: location.href,
    }));
    if (/需要登录|是否登录/.test(info.text)) return { needed: true, reason: 'modal-detected' };
    if (/登录/.test(info.text) && /注册/.test(info.text) && info.text.length < 600 && !info.text.includes('课程包'))
      return { needed: true, reason: 'login-form-only' };
    return { needed: false };
  } catch (e) { return { needed: true, reason: 'error:' + e.message }; }
}

// 登录后判断详情页内容已加载（回到 classActivity 且有实质内容且无登录弹窗）
async function isDetailReady(page) {
  try {
    const url = page.url();
    if (!url.includes('classActivity')) return false;
    const info = await page.evaluate(() => ({
      text: document.body.innerText || '',
      iframes: Array.from(document.querySelectorAll('iframe')).length,
      videos: Array.from(document.querySelectorAll('video')).length,
    }));
    if (/需要登录|是否登录/.test(info.text)) return false;
    if (info.text.length < 200 && !info.iframes && !info.videos) return false;
    return true;
  } catch (e) { return false; }
}

async function capture(page, label, sink) {
  const info = await page.evaluate(() => ({
    text: document.body.innerText || '',
    iframes: Array.from(document.querySelectorAll('iframe')).map(f => f.src || f.getAttribute('src') || '(none)'),
    videos: Array.from(document.querySelectorAll('video')).map(v => v.currentSrc || v.src || '(none)'),
    embeds: Array.from(document.querySelectorAll('embed,object')).map(e => e.data || e.getAttribute('data') || e.src || '(none)'),
    url: location.href,
  }));
  const entry = `\n===== ${label} =====\nURL: ${info.url}\nIFRAMES(${info.iframes.length}): ${JSON.stringify(info.iframes)}\nVIDEOS(${info.videos.length}): ${JSON.stringify(info.videos)}\nEMBEDS(${info.embeds.length}): ${JSON.stringify(info.embeds)}\nTEXT_LEN: ${info.text.length}\nTEXT:\n${info.text}`;
  sink.push(entry);
  console.log(`[capture] ${label} | iframes=${info.iframes.length} videos=${info.videos.length} textLen=${info.text.length}`);
  return info;
}

async function main() {
  console.log('启动 Chromium（可见窗口）...');
  const browser = await chromium.launch({
    headless: false,
    executablePath: CHROME_EXE,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const context = await browser.newContext({ viewport: { width: 1366, height: 850 } });
  const page = await context.newPage();

  // 打开详情页
  console.log('打开课程包详情页(classActivity)...');
  await page.goto(CLASS_ACTIVITY_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await wait(5000);
  await page.screenshot({ path: path.join(OUT, 'v3_initial.png') });
  console.log('初始截图: output/v3_initial.png');

  // 检查是否需要登录
  let loginCheck = await needsLogin(page);
  if (loginCheck.needed) {
    console.log(`检测到需要登录 (${loginCheck.reason})`);

    // 如果有「确定」按钮的登录弹窗，自动点击进入登录页
    if (loginCheck.reason === 'modal-detected') {
      const clicked = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button,a,div,span,[role="button"]'));
        const ok = btns.find(b => (b.innerText || '').trim() === '确定');
        if (ok) { ok.click(); return true; }
        return false;
      });
      if (clicked) {
        console.log('已自动点击「确定」，等待跳转到登录页...');
        await wait(3000);
      } else {
        console.log('未找到「确定」按钮，请手动点击登录弹窗中的确定。');
      }
    }

    // 等待用户完成登录
    console.log('BROWSER_READY_FOR_LOGIN');
    console.log('请在浏览器中完成登录（最长等待 300 秒）...');
    console.log('(登录成功后会自动跳回详情页并开始提取)');
    for (let i = 0; i < 100; i++) {
      await wait(3000);
      const ready = await isDetailReady(page);
      if (ready) {
        console.log(`✅ 检测到详情页已加载！(${(i + 1) * 3}s 后)`);
        break;
      }
      // 每 15s 报告一次状态
      if (i % 5 === 4) {
        const curUrl = page.url().slice(0, 80);
        console.log(`  ...等待登录/加载中 (${(i + 1) * 3}s, URL: ${curUrl}...)`);
      }
    }

    // 二次确认
    const finalReady = await isDetailReady(page);
    if (!finalReady) {
      console.log('❌ 超时：未能在时限内检测到详情页加载。退出。');
      await page.screenshot({ path: path.join(OUT, 'v3_timeout.png') });
      await browser.close();
      return;
    }
  } else {
    console.log('✅ 已处于登录状态，直接提取');
  }

  // 登录后确保页面稳定
  await wait(4000);

  const sink = [];
  await capture(page, '详情页-默认视图', sink);
  await page.screenshot({ path: path.join(OUT, 'v3_detail_default.png'), fullPage: false });

  // 遍历标签页：课件 / 教学设计 / 视频 / 作业 / 学案 / 素材 / 课程后练习
  const tabs = ['课件', '教学设计', '视频', '作业', '学案', '素材', '课程后练习'];
  for (const tab of tabs) {
    const clicked = await page.evaluate((t) => {
      const els = Array.from(document.querySelectorAll('div,a,span,li,button,[role="tab"]')).filter(
        e => (e.innerText || '').trim() === t
      );
      if (els.length) { els[0].click(); return true; }
      return false;
    }, tab);
    if (clicked) {
      console.log(`→ 点击标签: ${tab}`);
      await wait(4500);
      await capture(page, `标签-${tab}`, sink);
      await page.screenshot({ path: path.join(OUT, `v3_${tab}.png`), fullPage: false });
    }
  }

  fs.writeFileSync(path.join(OUT, 'v3_classactivity_detail.txt'), sink.join('\n\n'), 'utf-8');
  console.log('\n全量提取文本已保存: output/v3_classactivity_detail.txt');

  // 汇总报告
  const summary = sink.map(s => s.split('\n')[0]).join('\n');
  console.log('\n===== 提取汇总 =====');
  console.log(summary);

  console.log('\n✅ 提取完成。浏览器保持打开 180 秒供你查看，之后自动关闭。');
  await wait(180000);
  await browser.close();
  console.log('完成');
}

main().catch(err => { console.error('失败:', err); process.exit(1); });
