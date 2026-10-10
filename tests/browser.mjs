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
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE_PATH ? { executablePath: process.env.BROWSER_EXECUTABLE_PATH } : {}), args: process.env.BROWSER_ARGS_JSON ? JSON.parse(process.env.BROWSER_ARGS_JSON) : [] });
  const fontCSS = process.env.BROWSER_FONT_CSS ? await readFile(process.env.BROWSER_FONT_CSS, 'utf8') : '';
  const addFonts = async ctx => { if (fontCSS) await ctx.addInitScript(css => { document.addEventListener('DOMContentLoaded', () => { const style = document.createElement('style'); style.textContent = css; document.head.append(style); }); }, fontCSS); };
  const context = await browser.newContext({ viewport: { width: 1360, height: 1000 }, acceptDownloads: true });
  await addFonts(context);
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
  const tfContext = await browser.newContext({ viewport: { width: 1360, height: 1000 }, acceptDownloads: true }); await addFonts(tfContext);
  const tfPage = await tfContext.newPage(); tfPage.on('pageerror', error => errors.push(error.message)); tfPage.on('requestfailed', request => failedRequests.push(request.url()));
  await tfPage.goto(url); await tfPage.locator('#scene-title').filter({ hasText: '公寓' }).waitFor();
  const tfClick = async name => { await tfPage.getByRole('button', { name, exact: false }).first().click(); await tfPage.waitForTimeout(300); };
  const tfState = async () => tfPage.evaluate(() => ({ location: document.querySelector('#scene-title').textContent, time: document.querySelector('#clock').textContent, money: document.querySelector('[data-stat="core:money"]').textContent, energy: document.querySelector('[data-stat="core:energy"]').textContent }));
  await check('身体面板纯读取、自由换耳即时生效且不耗时', async () => {
    const before = await tfState(); await tfClick('身体'); assert.match(await tfPage.locator('#body-content').innerText(), /人类耳/); await tfClick('关闭身体'); assert.deepEqual(await tfState(), before);
    await tfClick('身体'); await tfClick('换成猫耳'); assert.match(await tfPage.locator('.body-summary').innerText(), /猫耳/); assert.deepEqual(await tfState(), before); await tfClick('关闭身体');
  });
  await check('真实生物尾与诊室拒绝冲突改造，仍有退出选择', async () => {
    await tfClick('身体'); await tfClick('长出生物尾'); assert.match(await tfPage.locator('.body-summary').innerText(), /生物长尾/); await tfClick('关闭身体');
    await tfClick('前往主街'); await tfClick('前往改造诊室'); await tfClick('了解机械尾改造'); assert.equal(await tfPage.getByRole('button', { name: /支付费用并开始改造/ }).isEnabled(), false); assert.match(await tfPage.locator('#actions').innerText(), /已有/);
    await tfClick('再了解一下过程'); await tfClick('这次先不改造'); assert.equal((await tfState()).money, '60币'); await tfClick('身体'); await tfClick('移除现有尾部'); await tfClick('关闭身体');
  });
  await check('机械尾预约扣一次费，允许非冲突耳型，尾部塑形被锁', async () => {
    await tfClick('了解机械尾改造'); await tfClick('支付费用并开始改造'); assert.equal((await tfState()).money, '42币');
    await tfClick('身体'); assert.match(await tfPage.locator('#body-content').innerText(), /0 \/ 45 分钟/); assert.equal(await tfPage.getByRole('button', { name: /长出生物尾/ }).isEnabled(), false); assert.match(await tfPage.locator('#body-content').innerText(), /预约/);
    await tfClick('换成狼耳'); assert.match(await tfPage.locator('.body-summary').innerText(), /狼耳/); await tfClick('关闭身体');
  });
  await check('15分钟试装实际连接机械尾，暂停后等待不增加进度', async () => {
    await tfClick('在诊室等候一会儿'); await tfClick('身体'); assert.match(await tfPage.locator('#body-content').innerText(), /15 \/ 45 分钟/); assert.match(await tfPage.locator('.body-summary').innerText(), /待校准/); assert.match(await tfPage.locator('.body-abilities').innerText(), /尾部抓握 0/);
    await tfClick('暂停机械尾改造'); await tfClick('关闭身体'); await tfClick('在诊室等候一会儿'); await tfClick('在诊室等候一会儿'); await tfClick('身体'); assert.match(await tfPage.locator('#body-content').innerText(), /15 \/ 45 分钟/); assert.match(await tfPage.locator('#body-content').innerText(), /已暂停/); await tfClick('关闭身体');
  });
  await check('TF暂停中 IndexedDB 保存/刷新恢复同一图和进度', async () => {
    const before = await tfState(); await tfClick('存档'); await tfClick('保存当前进度'); await tfPage.reload(); await tfPage.locator('#scene-title').filter({ hasText: '改造诊室' }).waitFor(); assert.deepEqual(await tfState(), before);
    await tfClick('身体'); assert.match(await tfPage.locator('#body-content').innerText(), /已暂停/); assert.match(await tfPage.locator('#body-content').innerText(), /15 \/ 45 分钟/); assert.match(await tfPage.locator('.body-summary').innerText(), /狼耳.*待校准/);
  });
  await check('继续TF只推进剩余阶段，45分钟得到真实抓握能力', async () => {
    await tfClick('继续机械尾改造'); await tfClick('关闭身体'); await tfClick('在诊室等候一会儿'); await tfClick('在诊室等候一会儿'); await tfClick('身体');
    assert.match(await tfPage.locator('#body-content').innerText(), /45 \/ 45 分钟/); assert.match(await tfPage.locator('.body-abilities').innerText(), /尾部抓握 1/); assert.equal((await tfState()).money, '42币');
    await tfPage.screenshot({ path: path.join(artifacts, 'body-desktop.png'), fullPage: true }); await tfClick('关闭身体');
  });
  let tfDownload;
  await check('新版JSON包含身体/阶段，读档不重复扣费或重新校准', async () => {
    await tfClick('存档'); const promise = tfPage.waitForEvent('download'); await tfPage.getByRole('button', { name: '导出 JSON', exact: true }).click(); const download = await promise; tfDownload = path.join(artifacts, 'browser-tf-save.json'); await download.saveAs(tfDownload);
    const json = JSON.parse(await readFile(tfDownload, 'utf8')); assert.equal(json.payload.schemaVersion, 2); assert.ok(json.payload.state.player.body.parts.some(x => x.definitionId === 'aetheria-tf:part.tail.mechanical')); assert.equal(json.payload.state.tfQueues.find(x => x.definitionId === 'aetheria-tf:tf.tail.mechanical').status, 'completed');
    await tfPage.locator('#save-import').setInputFiles(tfDownload); await tfPage.locator('#save-message').filter({ hasText: '已导入' }).waitFor(); assert.equal((await tfState()).money, '42币'); await tfClick('关闭存档');
  });
  await check('校准尾部解锁集市工作，移除后工作不可执行', async () => {
    await tfClick('前往主街'); await tfClick('前往集市'); const before = await tfState(); await tfClick('用机械尾协助分拣'); assert.equal((await tfState()).money, '56币'); assert.notEqual((await tfState()).time, before.time);
    await tfClick('存档'); await tfClick('保存当前进度'); await tfClick('关闭存档'); await tfClick('身体'); await tfClick('移除现有尾部'); assert.match(await tfPage.locator('.body-abilities').innerText(), /尾部抓握 0/); await tfClick('关闭身体'); assert.equal(await tfPage.getByRole('button', { name: /用机械尾协助分拣/ }).isEnabled(), false);
  });
  await check('第一阶段JSON在浏览器中升级并恢复原事件，不覆盖手动槽', async () => {
    await tfClick('存档'); await tfPage.locator('#save-import').setInputFiles(path.join(root, 'tests/fixtures/stage1-save.json')); await tfPage.locator('#save-message').filter({ hasText: '已导入' }).waitFor();
    assert.equal((await tfState()).location, '主街'); assert.match((await tfState()).time, /08:15/); assert.equal((await tfState()).money, '60币'); await tfClick('关闭存档'); assert.equal(await tfPage.locator('#scene-mode').innerText(), '正在发生');
    await tfClick('身体'); assert.match(await tfPage.locator('.body-summary').innerText(), /人类耳.*没有尾部/); await tfClick('关闭身体');
    await tfClick('存档'); await tfClick('读取存档'); await tfClick('关闭存档'); assert.equal((await tfState()).location, '集市'); assert.equal((await tfState()).money, '56币');
  });
  await check('390px身体面板、阶段状态与操作均可见，无横向溢出', async () => {
    await tfPage.setViewportSize({ width: 390, height: 844 }); await tfClick('身体'); assert.ok(await tfPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)); assert.ok(await tfPage.locator('#body-dialog').evaluate(d => d.scrollWidth <= d.clientWidth)); assert.match(await tfPage.locator('#body-content').innerText(), /尾部抓握 1/);
    await tfPage.screenshot({ path: path.join(artifacts, 'body-mobile.png'), fullPage: true }); await tfClick('关闭身体');
  });
  await check('第一阶段 IndexedDB 启动升级保留原记录，身体菜单不改时间', async () => {
    const legacyContext = await browser.newContext({ viewport: { width: 1360, height: 1000 } }); await addFonts(legacyContext); const legacyPage = await legacyContext.newPage();
    legacyPage.on('pageerror', error => errors.push(error.message)); legacyPage.on('requestfailed', request => failedRequests.push(request.url())); await legacyPage.goto(url); await legacyPage.locator('#scene-title').filter({ hasText: '公寓' }).waitFor();
    const legacyText = await readFile(path.join(root, 'tests/fixtures/stage1-save.json'), 'utf8');
    await legacyPage.evaluate(text => new Promise((resolve, reject) => { const request = indexedDB.open('aetheria-alpha-0.1', 1); request.onerror = () => reject(request.error); request.onsuccess = () => { const db = request.result, tx = db.transaction('slots', 'readwrite'); tx.objectStore('slots').put(text, 'manual'); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); }; }), legacyText);
    await legacyPage.reload(); await legacyPage.locator('#scene-mode').filter({ hasText: '正在发生' }).waitFor(); assert.match(await legacyPage.locator('#feedback').innerText(), /已升级/); assert.match(await legacyPage.locator('#clock').innerText(), /08:15/);
    await legacyPage.getByRole('button', { name: '身体', exact: true }).click(); assert.match(await legacyPage.locator('.body-summary').innerText(), /人类耳.*没有尾部/); assert.match(await legacyPage.locator('#clock').innerText(), /08:15/);
    const original = await legacyPage.evaluate(() => new Promise((resolve, reject) => { const request = indexedDB.open('aetheria-alpha-0.1', 1); request.onerror = () => reject(request.error); request.onsuccess = () => { const db = request.result, tx = db.transaction('slots', 'readonly'), read = tx.objectStore('slots').get('manual'); let text; read.onsuccess = () => { text = read.result; }; tx.oncomplete = () => { db.close(); resolve(text); }; tx.onerror = () => reject(tx.error); }; })); assert.equal(original, legacyText); await legacyContext.close();
  });
  await check('浏览器没有未捕获错误或失败网络请求', async () => { assert.deepEqual(errors, []); assert.deepEqual(failedRequests, []); });
  await writeFile(path.join(artifacts, 'browser-results.json'), JSON.stringify({ status: 'passed', browser: browser.version(), results }, null, 2));
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  await writeFile(path.join(artifacts, 'browser-results.json'), JSON.stringify({ status: 'failed', results, detail }, null, 2));
  console.error(detail); process.exitCode = 1;
} finally { await browser?.close(); server?.kill(); }
