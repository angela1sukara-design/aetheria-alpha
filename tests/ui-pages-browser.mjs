import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { districtGame, rikerRoute, da, must } from './district-helpers.ts';
import { SaveCodec } from '../src/persistence/codec.ts';

const root = path.resolve('.'), out = path.join(root, 'artifacts/ui-refresh');
await mkdir(out, { recursive: true });
const checks = [], errors = [];
const server = spawn(process.execPath, ['scripts/serve.mjs', '--built'], { cwd: root, env: { ...process.env, PORT: '4198' }, stdio: ['ignore', 'pipe', 'pipe'] });
let browser;
const check = async (name, run) => { await run(); checks.push(name); console.log('PASS ' + name); };
try {
  await new Promise((resolve, reject) => { const timeout = setTimeout(() => reject(Error('server timeout')), 10000); server.stdout.on('data', d => { if (String(d).includes('Aetheria Alpha')) { clearTimeout(timeout); resolve(); } }); server.on('error', reject); });
  browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  const context = await browser.newContext({ viewport: { width: 1360, height: 1000 }, acceptDownloads: true });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  const click = async selector => { await page.locator(selector).first().click(); await page.waitForTimeout(300); };
  const act = async id => { await click(`button[data-action="${id}"]`); assert.ok(!await page.locator('#feedback').evaluate(el => el.classList.contains('error')), await page.locator('#feedback').innerText()); };
  const capture = async name => page.screenshot({path:path.join(out, `${name}.png`), fullPage:true});
  const save = async () => { await click('#save-open'); await click('#save-write'); await page.locator('#save-message').filter({hasText:'保存完成'}).waitFor(); };
  const storedState = async () => page.evaluate(() => new Promise((resolve, reject) => { const request = indexedDB.open('aetheria-alpha-0.1', 1); request.onerror = () => reject(request.error); request.onsuccess = () => { const db = request.result, transaction = db.transaction('slots', 'readonly'), get = transaction.objectStore('slots').get('manual'); get.onsuccess = () => { db.close(); resolve(JSON.parse(get.result).payload.state); }; }; }));
  await page.goto('http://localhost:4198/');
  await page.locator('#scene-title').filter({hasText:'公寓'}).waitFor();
  await check('抵达页突出正文，地点介绍可主动展开且不推进时间', async () => {
    assert.equal(await page.locator('#scene-panel').getAttribute('data-mode'), 'arrival');
    const clock = await page.locator('#clock').innerText();
    await click('#location-review'); assert.ok(await page.locator('#location-details').isVisible());
    await click('#location-review'); assert.ok(!await page.locator('#location-details').isVisible());
    assert.equal(await page.locator('#clock').innerText(), clock);
  });
  await act('district:action.create');
  await check('十个菜单均为可返回子页，支持地址与浏览器后退，查看不改变进度', async () => {
    await save(); const before = await storedState(); await click('#page-home');
    for (const name of ['map','body','people','save','log','quest','bag','discovery','pack','world']) {
      await click(`#${name}-open`);
      assert.equal(new URL(page.url()).hash, `#/${name}`);
      assert.ok(await page.locator(`#${name}-dialog`).isVisible());
      assert.ok(!await page.locator('#play-page').isVisible());
      assert.equal(await page.locator('dialog:modal').count(), 0);
      await click(`#${name}-dialog [data-close]`);
      assert.ok(await page.locator('#play-page').isVisible());
    }
    await click('#bag-open'); await click('#quest-open'); await page.goBack();
    assert.ok(await page.locator('#bag-dialog').isVisible());
    await page.keyboard.press('Escape'); assert.ok(await page.locator('#play-page').isVisible());
    await save(); assert.deepEqual(await storedState(), before); await click('#page-home');
  });
  await act('aetheria:action.travel.apartment_street');
  await act('aetheria:action.travel.street_market');
  await act('district:action.travel.workshop.out');
  await check('工坊行动结果取代地点大标题和环境描写', async () => {
    await capture('workshop-arrival');
    const action = page.locator('#actions button[data-action]').filter({hasText:'在安全区处理伤势'}).first();
    await action.click(); await page.waitForTimeout(300);
    assert.equal(await page.locator('#scene-panel').getAttribute('data-mode'), 'result');
    assert.equal(await page.locator('#scene-title').innerText(), '在安全区处理伤势');
    assert.ok(!await page.locator('#scene-text').isVisible());
    assert.ok(await page.locator('#result-text').isVisible());
    assert.equal(await page.locator('#location-name').innerText(), '回声机械工坊');
    await capture('workshop-result');
    await click('#scene-return'); assert.equal(await page.locator('#scene-panel').getAttribute('data-mode'), 'hub');
    assert.ok(!await page.locator('#scene-text').isVisible());
  });
  await check('NPC对话成为独立剧情页，只提供当前事件选择', async () => {
    await act('district:action.riker.meet');
    assert.equal(await page.locator('#scene-panel').getAttribute('data-mode'), 'conversation');
    assert.match(await page.locator('#scene-title').innerText(), /莱克/);
    assert.ok(await page.locator('#scene-text').isVisible());
    assert.ok(!await page.locator('#scene-return').isVisible());
    assert.equal(await page.locator('#actions button[data-action*="preference"]').count(), 0);
    assert.equal(await page.locator('#actions button[data-group="travel"]:enabled').count(), 0);
    await capture('npc-conversation');
  });
  await check('人物列表、个人档案、返回列表与交谈入口完整衔接', async () => {
    await click('#people-open');
    await page.locator('#people-content .profile-open').filter({hasText:'查看人物档案'}).first().click();
    assert.match(new URL(page.url()).hash, /#\/people\//);
    assert.equal(await page.locator('#people-content').getAttribute('data-view'), 'detail');
    await capture('npc-profile');
    await click('#people-dialog [data-close]'); assert.equal(new URL(page.url()).hash, '#/people');
    await click('#people-dialog [data-close]'); assert.ok(await page.locator('#scene-text').isVisible());
  });
  await check('对话中存档、刷新、返回准确恢复同一段剧情，不重复结算', async () => {
    const text = await page.locator('#scene-text').innerText();
    await save(); const before = await storedState();
    await page.reload(); await page.locator('#save-info').filter({hasText:'回声机械工坊'}).waitFor();
    assert.ok(await page.locator('#save-dialog').isVisible());
    await click('#page-home');
    assert.equal(await page.locator('#scene-text').innerText(), text);
    assert.match(await page.locator('#scene-title').innerText(), /莱克/);
    await save(); assert.deepEqual(await storedState(), before); await click('#page-home');
  });
  await act('district:action.event.riker.meet.start.0');
  await check('身体子页操作留在该页，并立即显示本次变化', async () => {
    await click('#body-open'); await act('aetheria-tf:action.free.ears.cat');
    assert.ok(await page.locator('#body-dialog').isVisible());
    assert.match(await page.locator('.body-summary').innerText(), /猫耳/);
    assert.ok((await page.locator('#page-action-feedback').innerText()).length > 0);
    await capture('body-page'); await click('#page-home');
  });
  await check('360/390/768像素下所有子页可读，无横向溢出', async () => {
    for (const width of [360,390,768]) {
      await page.setViewportSize({width,height:844});
      for (const name of ['map','body','people','save','log','quest','bag','discovery','pack','world']) {
        await click(`#${name}-open`);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name} at ${width}`);
        await click('#page-home');
      }
    }
    await page.setViewportSize({width:390,height:844}); await capture('mobile-result');
    await click('#people-open'); await capture('mobile-people'); await click('#page-home');
    await page.setViewportSize({width:1360,height:1000});
  });
  await check('离线随机街区：居民档案、对话、协助和事件页面均可跳转', async () => {
    const offline = await context.newPage(); offline.on('pageerror', error => errors.push(error.message));
    await offline.goto(pathToFileURL(path.join(root,'dist/WorldGenerator-Seed-42.html')).href);
    await offline.locator('#world-current').filter({hasText:'种子 42'}).waitFor({state:'attached'});
    const oa = async id => { await offline.locator(`button[data-action="${id}"]`).first().click(); await offline.waitForTimeout(300); };
    await oa('worldgen:action.meet.0');
    assert.equal(await offline.locator('#scene-panel').getAttribute('data-mode'), 'residents');
    await offline.locator('#resident-nearby .profile-open').click();
    assert.equal(await offline.locator('#people-content').getAttribute('data-view'), 'detail');
    await offline.locator('#people-content button[data-action]').first().click(); await offline.waitForTimeout(300);
    assert.equal(await offline.locator('#scene-panel').getAttribute('data-mode'), 'conversation');
    assert.ok(!await offline.locator('#scene-text').isVisible());
    assert.match(await offline.locator('#scene-title').innerText(), /交谈/);
    assert.equal(await offline.locator('#actions button[data-group="travel"]').count(), 0);
    await oa('worldgen:action.help.0');
    await offline.screenshot({path:path.join(out,'resident-conversation.png'),fullPage:true});
    await offline.locator('#scene-return').click();
    await oa('worldgen:action.look.0');
    assert.equal(await offline.locator('#scene-panel').getAttribute('data-mode'), 'event');
    assert.equal(await offline.locator('#scene-title').innerText(), '眼前的遭遇');
    await offline.locator('button[data-action^="worldgen:action.event.finish."]').first().click(); await offline.waitForTimeout(300);
    assert.equal(await offline.locator('#scene-panel').getAttribute('data-mode'), 'result');
    await offline.close();
  });
  await check('战斗页面与战后事件切换，菜单返回不丢失回合', async () => {
    const {registry,engine} = await districtGame();
    da(engine,'create'); must(engine,'aetheria:action.travel.apartment_street'); must(engine,'aetheria:action.travel.street_market');
    da(engine,'travel.workshop.out'); da(engine,'travel.canal.out'); da(engine,'battle.scavenger');
    const file = path.join(out,'battle.json'); await writeFile(file,await new SaveCodec(registry).encode(engine.snapshot()));
    await click('#save-open'); await page.locator('#save-import').setInputFiles(file); await page.locator('#save-message').filter({hasText:'已导入'}).waitFor(); await click('#page-home');
    assert.equal(await page.locator('#scene-panel').getAttribute('data-mode'),'combat');
    assert.ok(!await page.locator('#scene-return').isVisible());
    await act('district:action.combat.guard'); const text = await page.locator('#scene-text').innerText();
    await click('#bag-open'); await click('#page-home'); assert.equal(await page.locator('#scene-text').innerText(),text);
    await capture('combat-page'); await act('district:action.combat.flee');
    assert.equal(await page.locator('#scene-panel').getAttribute('data-mode'),'event');
    await act('district:action.event.escape.scavenger.start.0');
    assert.equal(await page.locator('#scene-panel').getAttribute('data-mode'),'result');
  });
  await check('私人互动页面可暂停、读档、继续和合法退出', async () => {
    const {r,e} = await rikerRoute(); da(e,'riker.quiet'); da(e,'event.riker.quiet.private.0');
    const file = path.join(out,'interaction.json'); await writeFile(file,await new SaveCodec(r).encode(e.snapshot()));
    await click('#save-open'); await page.locator('#save-import').setInputFiles(file); await page.locator('#save-message').filter({hasText:'已导入'}).waitFor(); await click('#page-home');
    assert.equal(await page.locator('#scene-panel').getAttribute('data-mode'),'interaction');
    await act('district:action.scene.pause'); assert.match(await page.locator('#scene-subtitle').innerText(),/已暂停/);
    await save(); const before = await storedState(); await page.reload(); await page.locator('#save-info').filter({hasText:'工坊'}).waitFor(); await click('#page-home');
    assert.equal(await page.locator('#scene-panel').getAttribute('data-mode'),'interaction');
    assert.match(await page.locator('#scene-subtitle').innerText(),/已暂停/);
    await save(); assert.deepEqual(await storedState(),before); await click('#page-home');
    await act('district:action.scene.resume'); await capture('interaction-page');
    await act('district:action.scene.exit'); await act('district:action.event.riker.quiet.after.0');
    assert.equal(await page.locator('#scene-panel').getAttribute('data-mode'),'result');
  });
  assert.deepEqual(errors, []);
  await writeFile(path.join(out,'verification.json'), JSON.stringify({status:'passed',checks,errors},null,2));
} finally { await browser?.close(); server.kill(); }
