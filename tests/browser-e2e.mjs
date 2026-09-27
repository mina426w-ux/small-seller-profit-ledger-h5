import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const siteRoot = path.join(projectRoot, 'site');
const evidenceDir = process.env.LEDGER_EVIDENCE_DIR || path.join(projectRoot, 'evidence');
fs.mkdirSync(evidenceDir, { recursive: true });

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png'
};

function startStaticServer() {
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const filePath = path.resolve(siteRoot, relative);
    if (!filePath.startsWith(siteRoot) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      response.writeHead(404).end('Not found');
      return;
    }
    response.writeHead(200, { 'content-type': mime[path.extname(filePath)] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(response);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}/` });
    });
  });
}

async function expectText(page, selector, expected) {
  const text = (await page.locator(selector).textContent()).trim();
  assert.match(text, expected instanceof RegExp ? expected : new RegExp(String(expected).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

async function fillBaseline(page) {
  await page.fill('#entry-month', '2026-09');
  const values = {
    salesRevenue: '100000', refunds: '0', otherIncome: '0', totalOrders: '1000',
    simpleGoodsCost: '40000', shipping: '10000', platformFee: '10000', ads: '10000',
    employeeWages: '10000', rent: '8000'
  };
  for (const [id, value] of Object.entries(values)) await page.fill(`#${id}`, value);
}

async function assertMobileLayout(page, label) {
  const result = await page.evaluate(() => {
    const candidates = [...document.querySelectorAll('button, input')].filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0;
    });
    const offenders = candidates.filter((element) => {
      const rect = element.getBoundingClientRect();
      const compactRadio = element instanceof HTMLInputElement && element.type === 'radio';
      return rect.left < -1 || rect.right > window.innerWidth + 1 || (!compactRadio && (rect.width < 40 || rect.height < 40));
    }).map((element) => ({ id: element.id, text: element.textContent.trim(), rect: element.getBoundingClientRect().toJSON() }));
    return {
      innerWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      offenders
    };
  });
  assert.ok(result.documentWidth <= result.innerWidth, `${label} 文档横向溢出: ${JSON.stringify(result)}`);
  assert.ok(result.bodyWidth <= result.innerWidth, `${label} body 横向溢出: ${JSON.stringify(result)}`);
  assert.deepEqual(result.offenders, [], `${label} 存在按钮/输入框溢出或触控尺寸不足`);
}

let localServer;
const baseUrlFromEnv = process.env.H5_BASE_URL;
if (!baseUrlFromEnv) localServer = await startStaticServer();
const baseUrl = baseUrlFromEnv || localServer.baseUrl;
const browserExecutable = [
  process.env.BROWSER_EXECUTABLE,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
].find((candidate) => candidate && fs.existsSync(candidate));
const browser = await chromium.launch({
  headless: true,
  ...(browserExecutable ? { executablePath: browserExecutable } : {})
});
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const pageErrors = [];
const badResponses = [];

function watch(page) {
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') pageErrors.push(message.text()); });
  page.on('response', (response) => { if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); });
}

try {
  const page = await context.newPage();
  watch(page);
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.title(), '小卖家真实利润账本');
  assert.equal(await page.evaluate(() => window.__LEDGER_APP_READY__), true);
  assert.deepEqual(await page.evaluate(() => window.__LEDGER_DIAGNOSTICS__.errors), []);
  console.log('PASS H5 TEST 1 桌面浏览器真实打开，无 JavaScript 报错');

  await page.click('#home-create');
  await fillBaseline(page);
  await expectText(page, '#live-profit', /12,?000/);
  await page.click('button[type="submit"]');
  await page.waitForURL(/#result\/2026-09$/);
  await expectText(page, '#result-netRevenue', /100,?000/);
  await expectText(page, '#result-grossProfit', /60,?000/);
  await expectText(page, '#result-grossMargin', '60%');
  await expectText(page, '#result-contributionProfit', /30,?000/);
  await expectText(page, '#result-contributionMargin', '30%');
  await expectText(page, '#result-operatingProfit', /12,?000/);
  await expectText(page, '#result-netMargin', '12%');
  await expectText(page, '#result-averageOrderRevenue', '100 元');
  await expectText(page, '#result-averageOrderProfit', '12 元');
  await expectText(page, '#result-breakEvenRevenue', /60,?000 元/);
  await expectText(page, '#result-breakEvenText', /超过保本线 40,?000 元/);
  await expectText(page, '#cost-ranking', /商品成本/);
  await page.screenshot({ path: path.join(evidenceDir, 'h5-local-desktop-result.png'), fullPage: true });
  console.log('PASS H5 TEST 2 基准案例完整填写与结果逐项一致');

  await page.reload({ waitUntil: 'networkidle' });
  await expectText(page, '#result-operatingProfit', /12,?000/);
  console.log('PASS H5 TEST 3 刷新页面后数据仍存在');

  await page.close();
  const reopened = await context.newPage();
  watch(reopened);
  await reopened.goto(baseUrl, { waitUntil: 'networkidle' });
  await reopened.click('#header-history');
  await expectText(reopened, '.history-card[data-month="2026-09"]', /12,?000 元/);
  console.log('PASS H5 TEST 4 关闭页面后重新进入，历史记录仍存在');

  await reopened.locator('.history-card[data-month="2026-09"] button', { hasText: '修改' }).click();
  await reopened.fill('#rent', '10000');
  await reopened.click('button[type="submit"]');
  await reopened.waitForURL(/#result\/2026-09$/);
  await expectText(reopened, '#result-operatingProfit', /10,?000/);
  console.log('PASS H5 TEST 5 修改同月后结果覆盖更新');

  const mobile = await context.newPage();
  watch(mobile);
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.goto(`${baseUrl}#home/2026-09`, { waitUntil: 'networkidle' });
  await assertMobileLayout(mobile, '手机首页');
  await expectText(mobile, '#home-operating-profit', /10,?000/);
  await mobile.click('#home-view-result');
  await assertMobileLayout(mobile, '手机结果页');
  await expectText(mobile, '#result-finalProfit', /10,?000/);
  await mobile.click('#result-edit');
  await assertMobileLayout(mobile, '手机录入页');
  await mobile.screenshot({ path: path.join(evidenceDir, 'h5-local-mobile-entry.png'), fullPage: true });
  console.log('PASS H5 TEST 7 390×844 下无横向滚动、按钮遮挡或输入框溢出');
  await mobile.close();

  await reopened.click('#header-history');
  const deleteButton = reopened.locator('.history-card[data-month="2026-09"] button', { hasText: '删除' });
  reopened.once('dialog', (dialog) => dialog.dismiss());
  await deleteButton.click();
  assert.equal(await reopened.locator('.history-card[data-month="2026-09"]').count(), 1);
  reopened.once('dialog', (dialog) => dialog.accept());
  await deleteButton.click();
  assert.equal(await reopened.locator('.history-card[data-month="2026-09"]').count(), 0);
  assert.equal(await reopened.locator('#history-empty').isVisible(), true);
  console.log('PASS H5 TEST 6 删除二次确认有效：取消保留、确认删除');

  assert.deepEqual(pageErrors, [], `浏览器错误: ${pageErrors.join(' | ')}`);
  assert.deepEqual(badResponses, [], `资源加载失败: ${badResponses.join(' | ')}`);
  console.log(`\nH5_RESULT 7/7 PASSED base=${baseUrl}`);
} finally {
  await context.close();
  await browser.close();
  if (localServer) await new Promise((resolve) => localServer.server.close(resolve));
}
