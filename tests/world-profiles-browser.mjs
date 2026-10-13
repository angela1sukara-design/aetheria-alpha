import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve('.'), out = path.join(root, 'artifacts/world-profiles');
const catalog = JSON.parse(await readFile('content/generation/world-profiles.json', 'utf8'));
await mkdir(out, { recursive: true });
const errors = [], requests = [], checks = [];
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
let page;
try {
  const context = await browser.newContext({ viewport: { width: 1360, height: 1000 }, acceptDownloads: true });
  page = await context.newPage(); page.setDefaultTimeout(12000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (/^https?:/.test(r.url())) requests.push(r.url()); });
  await page.goto(pathToFileURL(path.join(root, 'dist/WorldGenerator-Seed-42.html')).href);
  await page.locator('#world-current').filter({ hasText: '种子 42' }).waitFor({ state: 'attached' });
  let serial = 0;
  async function state() {
    await page.locator('#save-open').click();
    const pending = page.waitForEvent('download'); await page.locator('#save-export').click();
    const file = path.join(out, `snapshot-${++serial}.json`); await (await pending).saveAs(file);
    const saved = JSON.parse(await readFile(file, 'utf8')).payload.state;
    await page.locator('#page-home').click(); return saved;
  }
  async function act(id) {
    if (await page.locator('#subpage-host').isVisible()) await page.locator('#page-home').click();
    if (await page.locator('#scene-return').isVisible()) await page.locator('#scene-return').click();
    const button = page.locator(`button[data-action="${id}"]`).first(); await button.click();
    // The UI intentionally rejects rapid consecutive clicks for 250 ms.
    await page.waitForTimeout(300);
    assert.ok(!await page.locator('#feedback').evaluate(e => e.classList.contains('error')), await page.locator('#feedback').innerText());
  }
  let current = await state();
  const initial = structuredClone(current), quests = current.worldInstance.definition.quests;
  const content = catalog.profiles.find(p => p.quests.id === quests.id).quests;
  const route = content.source.mainQuest.paths[0], otherRoute = content.source.mainQuest.paths[1];
  assert.equal(quests.stages.length, 8);
  assert.equal(quests.sides.length, 18);
  const tree = current.worldInstance.definition.relationshipTree;
  assert.equal(tree.mainQuestId, content.source.mainQuest.id);
  await page.locator('#people-open').click();
  assert.equal(await page.locator('.relationship-tree .relation-branch').count(), 2);
  assert.equal(await page.locator('.relationship-tree [data-relation-stage]').count(), 8);
  const relationText = await page.locator('.relationship-tree').innerText();
  assert.ok(relationText.includes(tree.goal));
  for (const resident of current.district.residents) assert.ok(!relationText.includes(resident.name));
  await page.screenshot({ path: path.join(out, 'relations-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: path.join(out, 'relations-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1360, height: 1000 }); await page.locator('#page-home').click();
  assert.deepEqual(await state(), initial);
  checks.push('主线作为关系树根、两条路线八个联络角色、未结识人物匿名、手机展示与浏览不改状态');
  await page.locator('#quest-open').click();
  const journal = await page.locator('#quest-content').innerText();
  assert.match(journal, /站上顶点/); assert.ok(journal.includes(route.style)); assert.ok(journal.includes(otherRoute.style));
  assert.doesNotMatch(journal, /百渠总管|雨棚盟首|百炉总匠|执印人/);
  await page.screenshot({ path: path.join(out, 'journal-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: path.join(out, 'journal-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1360, height: 1000 }); await page.locator('#page-home').click();
  assert.deepEqual(await state(), initial); checks.push('离线主线日志及手机展示可见，浏览不改变状态');
  async function travel(destination) {
    current = await state();
    const routes = current.worldInstance.definition.packs.find(p => p.manifest.id === 'generated/neighborhood').routes;
    const queue = [[current.world.locationId, []]], visited = new Set();
    while (queue.length) {
      const [place, steps] = queue.shift();
      if (place === destination) { for (const route of steps) await act(`worldgen:action.travel.${route.from.split('.').at(-1)}.${route.to.split('.').at(-1)}`); return; }
      if (visited.has(place)) continue; visited.add(place);
      for (const route of routes.filter(r => r.from === place)) queue.push([route.to, [...steps, route]]);
    }
    assert.fail('unreachable');
  }
  const first = quests.stages.find(b => b.id === 'resource_s1');
  await travel(first.locationId); await act(first.entryActionId); await act('main:action.resource_s1.leave');
  assert.equal((await state()).player.flags[first.flag], false);
  await act(first.entryActionId); await act('main:action.resource_s1.a');
  checks.push('首次进入、免费退出、原入口续接及真实阶段结算');
  const supportId = content.source.sideQuests[1].id;
  const support = quests.sides.find(b => b.id === supportId);
  await travel(support.locationId); await act(support.entryActionId); await act(`side:action.${support.id}.b`);
  const side = quests.sides.find(b => b.id.endsWith('.resident_3'));
  await travel(side.locationId); current = await state();
  const agent = current.worldInstance.agents.find(a => a.residentId === side.residentId);
  const now = current.clock.totalMinutes % 1440;
  if (!agent.schedule.some(s => s.locationId === side.locationId && now >= s.start && now < s.end)) {
    let wait = (agent.schedule.find(s => s.locationId === side.locationId).start - now + 1440) % 1440;
    while (wait >= 30) { await act(`worldgen:action.rest.${side.locationId.split('.').at(-1)}`); wait -= 30; }
    while (wait > 0) { await act(`worldgen:action.wait.short.${side.locationId.split('.').at(-1)}`); wait -= 5; }
    current = await state();
  }
  const person = current.district.residents.find(r => r.id === side.residentId);
  assert.equal(person.locationId, side.locationId);
  await act(side.entryActionId); assert.match(await page.locator('#scene-title').innerText(), new RegExp(person.name));
  await act(`side:action.${side.id}.b`);
  await page.locator('#people-open').click();
  await page.locator(`#people-content [data-npc="resident:${side.residentId}"] .profile-open`).click();
  assert.match(await page.locator('#people-content').innerText(), /共同背景/);
  assert.ok((await page.locator('#people-content').innerText()).includes(content.execution.sides[side.id].choices[1].memory));
  assert.ok((await page.locator('#people-content').innerText()).includes('主线位置'));
  assert.ok((await page.locator('#people-content').innerText()).includes('关联人物'));
  assert.equal(await page.locator('.relationship-tree').isVisible(),false);
  await page.screenshot({ path: path.join(out, 'resident-memory.png'), fullPage: true });
  await page.locator('#people-dialog [data-close="people-dialog"]').click();
  assert.ok((await page.locator('.relationship-tree').innerText()).includes(person.name));
  await page.locator('#page-home').click(); checks.push('绑定居民参与事件、共同背景及实际分支记忆可见');
  const second = quests.stages.find(b => b.id === 'resource_s2');
  await travel(second.locationId); await act(second.entryActionId); await act('main:action.resource_s2.supported');
  current = await state(); assert.equal(current.player.flags[second.flag], true); assert.equal(current.player.flags['main:flag.stewardship.1'], false);
  await page.locator('#quest-open').click();
  assert.ok((await page.locator('#quest-content').innerText()).includes(route.stages[2].name));
  assert.ok((await page.locator('#quest-content').innerText()).includes(otherRoute.stages[0].objective));
  await page.locator('#page-home').click(); checks.push('可选支线解锁额外方案，两条当地路线的日志分别推进');
  await travel(initial.worldInstance.definition.locations.find(l=>l.service==='market').id);
  for(let i=0;i<3;i++)await act('progression:action.rest');
  for(let i=0;i<3;i++)await act('progression:action.order');
  await act('progression:action.invest');
  current=await state();assert.ok(current.adventure.assets>=6);assert.ok(current.adventure.orders>=3);assert.ok(current.adventure.contracts>=2);
  checks.push('真实完成订单与经营登记，成长数值满足经营终局门槛');
  for (const [id, option] of [['resource_s3', 'a'], ['resource_s4', 'b']]) {
    const binding = quests.stages.find(b => b.id === id); await travel(binding.locationId); await act(binding.entryActionId); await act('main:action.' + id + '.' + option);
  }
  current = await state(); assert.equal(current.player.flags['main:flag.top_reached'], true);
  assert.deepEqual(current.rng, initial.rng);
  await page.locator('#quest-open').click(); assert.ok((await page.locator('#quest-content').innerText()).includes(content.execution.stages.resource_s4[1].result));
  await page.screenshot({ path: path.join(out, 'apex-ending.png'), fullPage: true });
  await page.locator('#save-open').click(); await page.locator('#save-write').click();
  await page.locator('#save-message').filter({ hasText: '保存完成' }).waitFor();
  await page.reload(); await page.locator('#world-current').filter({ hasText: '种子 42' }).waitFor({ state: 'attached' });
  assert.deepEqual(await state(), current); checks.push('当地终局称号、无运行时随机及保存刷新完整恢复');
  const visited = new Set(), ecology = initial.worldInstance.definition.setting.ecologyTag;
  for (const expected of catalog.profiles) {
    await page.locator('#world-open').click(); await page.locator('#world-seed').fill('42');
    await page.locator('#world-theme').selectOption(expected.tag);
    await page.locator('#world-dialog [data-close="world-dialog"]').click();
    assert.deepEqual(await state(),current);
    await page.locator('#world-open').click();
    await page.locator('#world-generate').click();
    await page.locator('#world-dialog').waitFor({state:'hidden'});
    await page.locator('#world-current').filter({ hasText: expected.name }).waitFor({ state: 'attached' });
    const generated = await state(), snapshot = generated.worldInstance.definition.quests;
    assert.equal(generated.worldInstance.definition.setting.tag,expected.tag);
    assert.equal(generated.worldInstance.definition.setting.ecologyTag,ecology);
    assert.equal(snapshot.id,expected.quests.id);
    visited.add(snapshot.id);
    assert.equal(snapshot.stages.length, 8); assert.ok(snapshot.sides.length >= 12 && snapshot.sides.length <= 18);
    assert.equal(expected.quests.source.sideQuests.length, 18);
    await page.locator('#quest-open').click();
    const actual = await page.locator('#quest-content').innerText();
    assert.ok(actual.includes(expected.quests.source.mainQuest.goal));
    for (const path of expected.quests.source.mainQuest.paths) assert.ok(actual.includes(path.style));
    assert.doesNotMatch(actual, /百渠总管|雨棚盟首|百炉总匠|执印人/);
    if(['world.cyberpunk','world.space-station','world.fantasy','world.xianxia'].includes(expected.id))await page.screenshot({ path: path.join(out, `${expected.id}.png`), fullPage: true });
    await page.locator('#page-home').click();
    current=generated;
    checks.push(`世界菜单指定 ${expected.name}：世界 Tag、生态独立、对应终局与当地支线池`);
  }
  assert.equal(visited.size, 17);
  assert.deepEqual(errors, []); assert.deepEqual(requests, []);
  checks.push('整个离线页面流程零网络请求、零脚本异常');
  console.log(JSON.stringify({ status: 'passed', checks }, null, 2));
} catch (error) {
  if (page) await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }).catch(() => {});
  errors.push(error.stack ?? String(error)); console.error(error); process.exitCode = 1;
} finally {
  await writeFile(path.join(out, 'browser-results.json'), JSON.stringify({ checks, errors, requests }, null, 2));
  await browser.close();
}
