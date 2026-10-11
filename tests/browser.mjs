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
    const json = JSON.parse(await readFile(tfDownload, 'utf8')); assert.equal(json.payload.schemaVersion, 3); assert.ok(json.payload.state.player.body.parts.some(x => x.definitionId === 'aetheria-tf:part.tail.mechanical')); assert.equal(json.payload.state.tfQueues.find(x => x.definitionId === 'aetheria-tf:tf.tail.mechanical').status, 'completed');
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
  const npcContext = await browser.newContext({ viewport: { width: 1360, height: 1000 }, acceptDownloads: true }); await addFonts(npcContext);
  const npcPage = await npcContext.newPage(); npcPage.on('pageerror', error => errors.push(error.message)); npcPage.on('requestfailed', request => failedRequests.push(request.url()));
  await npcPage.goto(url); await npcPage.locator('#scene-title').filter({ hasText: '公寓' }).waitFor();
  const npcClick = async name => { await npcPage.getByRole('button', { name, exact: false }).first().click(); await npcPage.waitForTimeout(300); };
  const money = async () => npcPage.locator('[data-stat="core:money"]').innerText();
  const minute = async () => { const time = await npcPage.locator('#clock').innerText(), match = time.match(/(\d\d):(\d\d)/); return Number(match[1]) * 60 + Number(match[2]); };
  await check('人物入口只读，未结识人物不提前列入档案', async () => {
    const before = await npcPage.locator('#clock').innerText(); await npcClick('人物'); assert.match(await npcPage.locator('#people-content').innerText(), /还没有正式结识/); await npcClick('关闭人物'); assert.equal(await npcPage.locator('#clock').innerText(), before);
  });
  await check('第五地点真实通路，NPC未到场没有交谈按钮；等候到日程后出现', async () => {
    await npcClick('前往主街'); await npcClick('前往薇尔维特沙龙'); assert.match(await npcPage.locator('#scene-text').innerText(), /09:00/); assert.equal(await npcPage.getByRole('button', { name: /与薇尔维特打招呼/ }).count(), 0);
    await npcClick('在门厅等候半小时'); await npcClick('在门厅等候半小时'); assert.equal(await npcPage.getByRole('button', { name: /与薇尔维特打招呼/ }).isEnabled(), true); assert.match(await npcPage.locator('#people-nearby').innerText(), /薇尔维特/);
  });
  await check('真实多轮谈话可换话题，重复相同话题不刷关系', async () => {
    await npcClick('与薇尔维特打招呼'); await npcClick('问问沙龙的服务'); await npcClick('接着聊别的话题'); await npcClick('问问沙龙的服务'); await npcClick('接着聊别的话题');
    await npcClick('人物'); assert.equal(await npcPage.locator('[data-relation="familiarity"]').innerText(), '熟悉 2'); assert.equal(await npcPage.locator('.npc-memories li').count(), 2); await npcClick('关闭人物');
  });
  await check('谈话中存档刷新恢复同一节点/记忆/关系，再读不重新结算', async () => {
    const prose = await npcPage.locator('#scene-text').innerText(), time = await npcPage.locator('#clock').innerText(); await npcClick('存档'); await npcClick('保存当前进度'); await npcPage.reload(); await npcPage.locator('#scene-mode').filter({ hasText: '正在发生' }).waitFor(); assert.equal(await npcPage.locator('#scene-text').innerText(), prose); assert.equal(await npcPage.locator('#clock').innerText(), time);
    await npcClick('人物'); assert.equal(await npcPage.locator('[data-relation="familiarity"]').innerText(), '熟悉 2'); await npcClick('关闭人物');
  });
  await check('委托未完成不能交差，真实集市操作也不让NPC远程知道结果', async () => {
    assert.equal(await npcPage.getByRole('button', { name: /交回集市核对结果/ }).isEnabled(), false); await npcClick('问她是否需要帮忙'); await npcClick('答应去集市核对清单'); await npcClick('前往主街'); await npcClick('前往集市'); await npcClick('替薇尔维特核对补货清单');
    assert.equal(await npcPage.getByRole('button', { name: /替薇尔维特核对补货清单/ }).isEnabled(), false); await npcClick('人物'); assert.equal(await npcPage.locator('[data-memory="aetheria-social:memory.velvet.reported"]').count(), 0); assert.equal(await npcPage.locator('[data-relation="trust"]').innerText(), '信任 1'); await npcClick('关闭人物');
  });
  await check('回来交差结算真实报酬与信任，同一委托不可再次交付', async () => {
    await npcClick('前往主街'); await npcClick('前往薇尔维特沙龙'); await npcClick('与薇尔维特继续交谈'); const before = parseInt(await money()); await npcClick('交回集市核对结果'); assert.equal(parseInt(await money()), before + 8); await npcClick('接着聊别的话题'); assert.equal(await npcPage.getByRole('button', { name: /交回集市核对结果/ }).isEnabled(), false);
    await npcClick('人物'); assert.equal(await npcPage.locator('[data-relation="trust"]').innerText(), '信任 7'); assert.equal(await npcPage.locator('[data-memory="aetheria-social:memory.velvet.reported"]').count(), 1); await npcClick('关闭人物');
  });
  await check('关系解锁近况话题，NPC档案可查看真实日程与已发生记忆', async () => {
    await npcClick('聊聊近况'); await npcClick('结束交谈'); await npcClick('人物'); assert.match(await npcPage.locator('#people-content').innerText(), /补货清单/); assert.equal(await npcPage.locator('[data-relation="familiarity"]').innerText(), '熟悉 7'); await npcPage.getByText('日常行程', { exact: true }).click(); assert.match(await npcPage.locator('.npc-schedule').innerText(), /18:00–19:00/); await npcPage.screenshot({ path: path.join(artifacts, 'npc-desktop.png'), fullPage: true }); await npcClick('关闭人物');
  });
  let npcDownload;
  await check('NPC存档JSON包含稳定身份/来源记忆，导入可恢复整个关系闭环', async () => {
    await npcClick('存档'); await npcClick('保存当前进度'); const promise = npcPage.waitForEvent('download'); await npcPage.getByRole('button', { name: '导出 JSON', exact: true }).click(); const download = await promise; npcDownload = path.join(artifacts, 'browser-npc-save.json'); await download.saveAs(npcDownload);
    const saved = JSON.parse(await readFile(npcDownload, 'utf8')); assert.equal(saved.payload.schemaVersion, 3); assert.equal(saved.payload.state.npcs[0].instanceId, 'fixed:aetheria-social:npc.velvet'); assert.equal(saved.payload.state.npcs[0].relationship.trust, 7); assert.ok(saved.payload.state.npcs[0].memories.every(m => m.sourceRequestId)); await npcPage.locator('#save-import').setInputFiles(npcDownload); await npcPage.locator('#save-message').filter({ hasText: '已导入' }).waitFor(); await npcClick('关闭存档');
  });
  await check('390px人物菜单/长记忆/日程可阅读操作，无横向溢出', async () => {
    await npcPage.setViewportSize({ width: 390, height: 844 }); await npcClick('人物'); assert.ok(await npcPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)); assert.ok(await npcPage.locator('#people-dialog').evaluate(d => d.scrollWidth <= d.clientWidth)); assert.equal(await npcPage.locator('[data-relation="trust"]').innerText(), '信任 7'); await npcPage.screenshot({ path: path.join(artifacts, 'npc-mobile.png'), fullPage: true }); await npcClick('关闭人物'); await npcPage.setViewportSize({ width: 1360, height: 1000 });
  });
  await check('真实等候到关店：交谈跨时段暂留NPC，退出后去集市还能遇见', async () => {
    while (await minute() < 1050) await npcClick('在门厅等候半小时');
    await npcClick('与薇尔维特继续交谈'); while (await minute() < 1080) { await npcClick('问问沙龙的服务'); await npcClick('接着聊别的话题'); }
    assert.match(await npcPage.locator('#people-nearby').innerText(), /薇尔维特/); await npcClick('结束交谈'); assert.equal(await npcPage.getByRole('button', { name: /与薇尔维特继续交谈/ }).count(), 0);
    assert.match(await npcPage.locator('#result-text').innerText(), /现在在集市/); assert.match(await npcPage.locator('#people-nearby').innerText(), /第 2 天 · 09:00/); assert.equal(await npcPage.locator('#people-nearby [data-present="false"]').count(), 1);
    await npcClick('前往主街'); await npcClick('前往集市'); assert.equal(await npcPage.getByRole('button', { name: /与薇尔维特继续交谈/ }).isEnabled(), true);
  });
  await check('第二阶段IndexedDB启动精确升级，猫耳/暂停TF原样恢复且原槽不覆盖', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1360, height: 1000 } }); await addFonts(ctx); const p = await ctx.newPage(); p.on('pageerror', error => errors.push(error.message)); p.on('requestfailed', request => failedRequests.push(request.url())); await p.goto(url); await p.locator('#scene-title').filter({ hasText: '公寓' }).waitFor(); const original = await readFile(path.join(root, 'tests/fixtures/stage2-save.json'), 'utf8');
    await p.evaluate(text => new Promise((resolve, reject) => { const r = indexedDB.open('aetheria-alpha-0.1', 1); r.onerror = () => reject(r.error); r.onsuccess = () => { const db = r.result, tx = db.transaction('slots', 'readwrite'); tx.objectStore('slots').put(text, 'manual'); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); }; }), original);
    await p.reload(); await p.locator('#feedback').filter({ hasText: '第二阶段存档已升级' }).waitFor(); assert.match(await p.locator('#scene-title').innerText(), /改造诊室/); await p.getByRole('button', { name: '身体', exact: true }).click(); assert.match(await p.locator('#body-content').innerText(), /已暂停/); assert.match(await p.locator('#body-content').innerText(), /15 \/ 45 分钟/); assert.match(await p.locator('.body-summary').innerText(), /猫耳.*待校准/);
    const raw = await p.evaluate(() => new Promise((resolve, reject) => { const r = indexedDB.open('aetheria-alpha-0.1', 1); r.onerror = () => reject(r.error); r.onsuccess = () => { const db = r.result, tx = db.transaction('slots', 'readonly'), q = tx.objectStore('slots').get('manual'); let text; q.onsuccess = () => { text = q.result; }; tx.oncomplete = () => { db.close(); resolve(text); }; tx.onerror = () => reject(tx.error); }; })); assert.equal(raw, original); await ctx.close();
  });
  await check('白天交差后人物档案仍有真实再访入口，执行后关闭面板', async () => {
    await npcClick('存档'); await npcPage.locator('#save-import').setInputFiles(npcDownload); await npcPage.locator('#save-message').filter({ hasText: '已导入' }).waitFor(); await npcClick('关闭存档');
    assert.equal(await npcPage.locator('#people-nearby [data-present="true"]').count(), 1);
    await npcClick('人物'); await npcPage.locator('#people-content button[data-action="aetheria-social:action.velvet.return"]').click(); await npcPage.waitForTimeout(300);
    assert.equal(await npcPage.locator('#people-dialog').isVisible(), false); assert.equal(await npcPage.locator('#scene-mode').innerText(), '正在发生'); await npcClick('结束交谈');
  });
  const repairContext = await browser.newContext({ viewport: { width: 1360, height: 1000 }, acceptDownloads: true }); await addFonts(repairContext);
  const repairPage = await repairContext.newPage(); repairPage.on('pageerror', error => errors.push(error.message)); repairPage.on('requestfailed', request => failedRequests.push(request.url()));
  await repairPage.goto(url); await repairPage.locator('#scene-title').filter({ hasText: '公寓' }).waitFor();
  const repairClick = async name => { await repairPage.getByRole('button', { name, exact: false }).first().click(); await repairPage.waitForTimeout(300); };
  const repairMinute = async () => { const time = await repairPage.locator('#clock').innerText(), match = time.match(/(\d\d):(\d\d)/); return Number(match[1]) * 60 + Number(match[2]); };
  const repairReadSlot = () => repairPage.evaluate(() => new Promise((resolve, reject) => { const r = indexedDB.open('aetheria-alpha-0.1', 1); r.onerror = () => reject(r.error); r.onsuccess = () => { const db = r.result, tx = db.transaction('slots', 'readonly'), q = tx.objectStore('slots').get('manual'); let text; q.onsuccess = () => { text = q.result; }; tx.oncomplete = () => { db.close(); resolve(text); }; tx.onerror = () => reject(tx.error); }; }));
  const stage3Original = await readFile(path.join(root, 'tests/fixtures/stage3-npc-save.json'), 'utf8');
  await check('第三阶段真实任务旧档启动升级，离场卡/关系/记忆保留且不覆盖原槽', async () => {
    await repairPage.evaluate(text => new Promise((resolve, reject) => { const r = indexedDB.open('aetheria-alpha-0.1', 1); r.onerror = () => reject(r.error); r.onsuccess = () => { const db = r.result, tx = db.transaction('slots', 'readwrite'); tx.objectStore('slots').put(text, 'manual'); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); }; }), stage3Original);
    await repairPage.reload(); await repairPage.locator('#feedback').filter({ hasText: '第三阶段存档已修复升级' }).waitFor();
    assert.match(await repairPage.locator('#clock').innerText(), /18:05/); assert.match(await repairPage.locator('#people-nearby').innerText(), /此刻在集市/); assert.match(await repairPage.locator('#people-nearby').innerText(), /第 2 天 · 09:00/);
    await repairClick('查看去向与再会'); assert.equal(await repairPage.locator('[data-relation="trust"]').innerText(), '信任 7'); assert.equal(await repairPage.locator('.npc-memories li').count(), 3); assert.equal(await repairReadSlot(), stage3Original);
  });
  await check('去向入口打开真实地图并关闭人物面板，查看不推进时间', async () => {
    const before = await repairPage.locator('#clock').innerText(); await repairClick('打开地图'); assert.equal(await repairPage.locator('#people-dialog').isVisible(), false); assert.equal(await repairPage.locator('#map-dialog').isVisible(), true);
    assert.match(await repairPage.locator('#map-people').innerText(), /薇尔维特 · 此刻在集市/); assert.equal(await repairPage.locator('#clock').innerText(), before); await repairClick('关闭地图');
  });
  await check('按去向实际追到集市继续交谈，19点后离场有说明和次日会面', async () => {
    await repairClick('前往主街'); await repairClick('前往集市'); await repairClick('人物');
    await repairPage.locator('#people-content button[data-action="aetheria-social:action.velvet.return"]').click(); await repairPage.waitForTimeout(300); assert.equal(await repairPage.locator('#people-dialog').isVisible(), false);
    while (await repairMinute() < 1140) { await repairClick('问问沙龙的服务'); await repairClick('接着聊别的话题'); }
    assert.equal(await repairPage.locator('#people-nearby [data-present="true"]').count(), 1); await repairClick('结束交谈');
    assert.match(await repairPage.locator('#result-text').innerText(), /离开了公开场所/); assert.match(await repairPage.locator('#people-nearby').innerText(), /此刻不在公开场所/); assert.match(await repairPage.locator('#people-nearby').innerText(), /第 2 天 · 09:00/);
    assert.equal(await repairPage.getByRole('button', { name: /与薇尔维特继续交谈/ }).count(), 0);
  });
  await check('离场后390px人物去向/再会/地图可操作，均无横向溢出', async () => {
    await repairPage.setViewportSize({ width: 390, height: 844 }); assert.ok(await repairPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await repairClick('查看去向与再会'); assert.match(await repairPage.locator('#people-content').innerText(), /第 2 天 · 09:00/); assert.ok(await repairPage.locator('#people-dialog').evaluate(d => d.scrollWidth <= d.clientWidth));
    await repairPage.screenshot({ path: path.join(artifacts, 'npc-absence-mobile.png'), fullPage: true }); await repairClick('打开地图'); assert.match(await repairPage.locator('#map-people').innerText(), /09:00/); assert.ok(await repairPage.locator('#map-dialog').evaluate(d => d.scrollWidth <= d.clientWidth)); await repairClick('关闭地图'); await repairPage.setViewportSize({ width: 1360, height: 1000 });
  });
  await check('离场存档刷新保留关系；真实等到次日同一人物重新出现', async () => {
    await repairClick('存档'); await repairClick('保存当前进度'); await repairPage.reload(); await repairPage.locator('#scene-title').filter({ hasText: '集市' }).waitFor();
    await repairClick('人物'); assert.equal(await repairPage.locator('[data-relation="trust"]').innerText(), '信任 7'); assert.equal(await repairPage.locator('.npc-memories li').count(), 4); await repairClick('关闭人物');
    await repairClick('前往主街'); await repairClick('前往薇尔维特沙龙');
    while (!/第 2 天/.test(await repairPage.locator('#clock').innerText()) || await repairMinute() < 540) await repairClick('在门厅等候半小时');
    assert.equal(await repairPage.locator('#people-nearby [data-present="true"]').count(), 1); assert.match(await repairPage.locator('#result-text').innerText(), /来到薇尔维特沙龙/); assert.equal(await repairPage.getByRole('button', { name: /与薇尔维特继续交谈/ }).isEnabled(), true);
    await repairClick('与薇尔维特继续交谈'); await repairClick('结束交谈');
  });
  await check('导入尚未认识NPC的旧档会清空地图人物，原手动槽保留', async () => {
    const before = await repairReadSlot(); await repairClick('存档'); await repairPage.locator('#save-import').setInputFiles(path.join(root, 'tests/fixtures/stage1-save.json')); await repairPage.locator('#save-message').filter({ hasText: '已导入' }).waitFor(); await repairClick('关闭存档');
    await repairClick('地图'); assert.equal(await repairPage.locator('#map-people').innerText(), ''); await repairClick('关闭地图'); assert.equal(await repairReadSlot(), before);
  });
  await check('原版零精力沙龙旧档：返程预先禁用，真实免费休息后返回公寓', async () => {
    await repairClick('存档'); await repairPage.locator('#save-import').setInputFiles(path.join(root, 'tests/fixtures/stage3-exhausted-save.json')); await repairPage.locator('#save-message').filter({ hasText: '已导入' }).waitFor(); await repairClick('关闭存档');
    assert.equal(await repairPage.locator('[data-stat="core:energy"]').innerText(), '0'); assert.equal(await repairPage.getByRole('button', { name: /前往主街/ }).isEnabled(), false); assert.match(await repairPage.locator('#actions').innerText(), /精力不足/);
    const cash = await repairPage.locator('[data-stat="core:money"]').innerText(), time = await repairMinute(); await repairClick('在门厅休息恢复精力'); assert.equal(await repairPage.locator('[data-stat="core:energy"]').innerText(), '10'); assert.equal(await repairPage.locator('[data-stat="core:money"]').innerText(), cash); assert.equal(await repairMinute(), time + 30);
    await repairClick('前往主街'); await repairClick('前往公寓'); assert.equal(await repairPage.locator('#scene-title').innerText(), '公寓');
    await repairClick('在床边歇一会儿'); assert.ok(parseInt(await repairPage.locator('[data-stat="core:energy"]').innerText()) > 8);
  });
  await check('浏览器没有未捕获错误或失败网络请求', async () => { assert.deepEqual(errors, []); assert.deepEqual(failedRequests, []); });
  await writeFile(path.join(artifacts, 'browser-results.json'), JSON.stringify({ status: 'passed', browser: browser.version(), results }, null, 2));
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  await writeFile(path.join(artifacts, 'browser-results.json'), JSON.stringify({ status: 'failed', results, detail }, null, 2));
  console.error(detail); process.exitCode = 1;
} finally { await browser?.close(); server?.kill(); }
