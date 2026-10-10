import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url)); const artifacts = path.join(root, 'artifacts'); await mkdir(artifacts, { recursive: true });
const url = process.env.BROWSER_TEST_URL || 'http://localhost:4173/'; let server; let browser;
const results = []; const errors = []; const failedRequests = [];
async function check(name, run) { await run(); results.push({ name, status: 'passed' }); console.log(`PASS ${name}`); }
try {
  if (!process.env.BROWSER_TEST_URL) {
    server = spawn(process.execPath, [path.join(root, 'scripts/serve.mjs')], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise((resolve, reject) => { const timeout = setTimeout(() => reject(new Error('测试服务器启动超时。')), 20000); server.stdout.on('data', data => { if (String(data).includes('Aetheria Alpha')) { clearTimeout(timeout); resolve(); } }); server.on('error', reject); server.on('exit', code => { if (code) reject(new Error(`测试服务器退出 ${code}`)); }); });
  }
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1360, height: 1000 }, acceptDownloads: true });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message)); page.on('requestfailed', request => failedRequests.push(request.url()));
  await page.goto(url); await page.locator('#scene-title').filter({ hasText: '公寓' }).waitFor();
  const state = async () => page.evaluate(() => ({ location: document.querySelector('#scene-title').textContent, time: document.querySelector('#clock').textContent, money: document.querySelector('[data-stat="core:money"]').textContent, energy: document.querySelector('[data-stat="core:energy"]').textContent, scene: document.querySelector('#scene-text').textContent, result: document.querySelector('#result-text').textContent }));
  const click = async name => { await page.getByRole('button', { name, exact: false }).first().click(); await page.waitForTimeout(300); };
  await check('首次加载、公寓正文和真实行动', async () => { const s = await state(); assert.equal(s.location, '公寓'); assert.match(s.time, /08:00/); assert.ok(await page.getByRole('button', { name: /前往主街/ }).isEnabled()); });
  await check('查看地图/记录不推进时间', async () => { const before = await state(); await click('地图'); await click('关闭地图'); await click('记录'); await click('关闭记录'); assert.deepEqual(await state(), before); });
  await check('公寓→主街→集市真实移动与时间推进', async () => { await click('前往主街'); await click('前往集市'); const s = await state(); assert.equal(s.location, '集市'); assert.match(s.time, /08:20/); assert.match(s.result, /集市/); });
  await check('工作改变精力/金钱并给出后续说明', async () => { await click('帮摊位整理货箱'); const s = await state(); assert.equal(s.money, '72币'); assert.equal(s.energy, '60'); assert.match(s.time, /08:50/); assert.match(s.result, /报酬当场付清/); });
  await check('买热食正确扣款和恢复', async () => { await click('买一份热食'); const s = await state(); assert.equal(s.money, '64币'); assert.equal(s.energy, '78'); assert.match(s.time, /09:05/); });
  await click('前往主街'); await click('看看被风掀起的告示');
  let eventState;
  await check('事件中途 IndexedDB 保存与刷新恢复', async () => { eventState = await state(); await click('存档'); await click('保存当前进度'); assert.match(await page.locator('#save-message').innerText(), /保存完成/); await page.reload(); await page.locator('#scene-mode').filter({ hasText: '正在发生' }).waitFor(); assert.deepEqual(await state(), eventState); });
  await check('选择结算与一次性奖励', async () => { await click('替摊位把告示固定好'); const s = await state(); assert.equal(s.money, '70币'); assert.equal(s.energy, '73'); assert.match(s.result, /收好报酬/); assert.equal(await page.getByRole('button', { name: /看看被风掀起/ }).isEnabled(), false); });
  await check('手动读档返回保存节点且不重抽文字', async () => { await click('存档'); await click('读取存档'); await click('关闭存档'); assert.deepEqual(await state(), eventState); });
  await check('合法退出不获得未走分支的奖励', async () => { await click('把夹子放回去'); const s = await state(); assert.equal(s.money, '64币'); assert.equal(await page.locator('#scene-mode').innerText(), '当前所在'); });
  let downloaded;
  await check('导出 JSON 下载有效存档', async () => { await click('存档'); const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: '导出 JSON', exact: true }).click(); const download = await downloadPromise; downloaded = path.join(artifacts, 'browser-save.json'); await download.saveAs(downloaded); assert.equal(JSON.parse(await readFile(downloaded, 'utf8')).payload.format, 'aetheria-alpha'); });
  await check('导入 JSON 恢复当前游戏', async () => { await page.locator('#save-import').setInputFiles(downloaded); await page.locator('#save-message').filter({ hasText: '已导入' }).waitFor(); assert.equal((await state()).money, '64币'); await click('关闭存档'); });
  await page.screenshot({ path: path.join(artifacts, 'desktop.png'), fullPage: true });
  await check('390px 窄屏不产生横向溢出且菜单可操作', async () => { await page.setViewportSize({ width: 390, height: 844 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)); await click('地图'); assert.ok(await page.locator('#map-dialog').isVisible()); await click('关闭地图'); await page.screenshot({ path: path.join(artifacts, 'mobile.png'), fullPage: true }); });
  await check('浏览器没有未捕获错误或失败网络请求', async () => { assert.deepEqual(errors, []); assert.deepEqual(failedRequests, []); });
  await writeFile(path.join(artifacts, 'browser-results.json'), JSON.stringify({ status: 'passed', results }, null, 2));
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  await writeFile(path.join(artifacts, 'browser-results.json'), JSON.stringify({ status: 'failed', results, detail }, null, 2));
  console.error(detail); process.exitCode = 1;
} finally { await browser?.close(); server?.kill(); }
