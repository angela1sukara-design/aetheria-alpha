import { clickUI } from './ui-navigation.mjs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve('.'), out = path.join(root, 'artifacts/worldgen'); await mkdir(out, { recursive: true });
const results = [], errors = [];
const manifest = JSON.parse(await readFile(path.join(root,'dist/worlds/manifest.json'),'utf8'));
const worldName = seed => manifest.worlds.find(w=>w.seed===seed).name;
let browser;
const server = spawn(process.execPath, ['scripts/serve.mjs', '--built'], { cwd: root, env: { ...process.env, PORT: '4197' }, stdio: ['ignore', 'pipe', 'pipe'] });
const check = async (name, fn) => { await fn(); results.push({ name, status: 'passed' }); console.log('PASS ' + name); };
try {
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(Error('server timeout')), 10000); server.stdout.on('data', d => { if (String(d).includes('Aetheria Alpha')) { clearTimeout(timer); resolve(); } }); server.on('error', reject); server.on('exit', code => { if (code) reject(Error('server exit ' + code)); }); });
  browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  const context = await browser.newContext({ viewport: { width: 1360, height: 1000 }, acceptDownloads: true });
  const page = await context.newPage(); page.setDefaultTimeout(12000); page.on('pageerror', e => errors.push(e.message)); page.on('response', r => { if(r.status()>=400)errors.push(r.status()+' '+r.url()); });
  const click = (p, name) => clickUI(p, name, true);
  const act = async id => { const button = page.locator(`button[data-action="${id}"]`).first(); if (!await button.isVisible() && await page.locator('#subpage-host').isVisible()) await page.locator('#page-home').click(); await button.click(); await page.waitForTimeout(300); assert.ok(!await page.locator('#feedback').evaluate(el => el.classList.contains('error')), await page.locator('#feedback').innerText()); };
  const snapshot = async (p = page, filename = 'current') => { await click(p, '存档'); const pending = p.waitForEvent('download'); await click(p, '导出 JSON'); const download = await pending, dest = path.join(out, filename + '.json'); await download.saveAs(dest); await click(p, '关闭存档'); return JSON.parse(await readFile(dest, 'utf8')).payload.state; };
  await page.goto('http://localhost:4197/'); await page.locator('#location-name').filter({ hasText: '公寓' }).waitFor({state:"attached"});
  let initial, remembered;
  await check('固定世界保留；通过世界菜单实际生成并进入种子42街区', async () => {
    await snapshot(page,'fixed-initial');
    await click(page, '世界'); await page.locator('#world-seed').fill('42'); await click(page, '生成并进入世界');
    await page.locator('#world-current').filter({hasText:worldName(42)}).waitFor({state:"attached"}); initial = await snapshot(page,'seed42-initial'); assert.equal(initial.worldInstance.generation.seed,42);assert.equal(initial.district.residents.length,9);
    assert.ok(initial.worldInstance.generation.contentPacks.some(p=>p.id==='aetheria/neighborhood-lexicon'));
    assert.ok(initial.district.residents.every(r=>r.appearance.includes('衣着：')));
  });
  await check('地图只显示本世界7个地点，查看地图和人物不改状态，手机菜单可用', async () => {
    await click(page,'地图'); assert.equal(await page.locator('#map-content .map-label').count(),7);assert.doesNotMatch(await page.locator('#map-content').innerText(),/薇尔维特|回声机械/);await click(page,'关闭地图');
    await click(page,'人物');await click(page,'关闭人物');assert.deepEqual(await snapshot(),initial);
    await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await click(page,'世界');assert.ok(await page.locator('#world-generate').isVisible());await click(page,'关闭世界');await page.screenshot({path:path.join(out,'mobile.png'),fullPage:true});await page.setViewportSize({width:1360,height:1000});
  });
  await check('生成地点的工作、恢复、事件选择和原身体TF按钮均可结算',async()=>{
    await act('worldgen:action.work.0');await act('worldgen:action.rest.0');await act('worldgen:action.look.0');assert.equal(await page.locator('#scene-mode').innerText(),'正在发生');await act(await page.locator('[data-action^="worldgen:action.event.finish."]').first().getAttribute('data-action'));
    await click(page,'身体');await act('aetheria-tf:action.free.ears.cat');assert.match(await page.locator('.body-summary').innerText(),/猫耳/);await click(page,'关闭身体');
    const s=await snapshot();assert.ok(s.player.variables['core:money']>initial.player.variables['core:money']);assert.equal(s.eventInstances[0].status,'completed');
  });
  const travelTo = async to => {
    if (await page.locator('#scene-return').isVisible()) await page.locator('#scene-return').click();
    const state=await snapshot(),routes=state.worldInstance.definition.packs.find(p=>p.manifest.id==='generated/neighborhood').routes;
    const queue=[[state.world.locationId,[]]],seen=new Set();let found;
    while(queue.length){const [loc,steps]=queue.shift();if(loc===to){found=steps;break;}if(seen.has(loc))continue;seen.add(loc);for(const r of routes.filter(r=>r.from===loc))queue.push([r.to,[...steps,r]]);}
    assert.ok(found);for(const r of found)await act(`worldgen:action.travel.${r.from.split('.').at(-1)}.${r.to.split('.').at(-1)}`);
  };
  await check('浏览在场居民不触发事件、不推进时钟或RNG；本地活动实际结算',async()=>{
    const before=await snapshot(page,'before-browsing');
    await act('worldgen:action.meet.0');await act('worldgen:action.meet.0');
    const browsed=await snapshot(page,'after-browsing');
    assert.equal(browsed.activeEventStack.length,0);assert.ok(browsed.district.currentResidentId);
    assert.deepEqual(browsed.rng,before.rng);assert.deepEqual(browsed.clock,before.clock);assert.deepEqual(browsed.district.storyletHistory,before.district.storyletHistory);
    assert.match(await page.locator('#resident-nearby').innerText(),/位居民停留/);
    assert.match(await page.locator('#resident-nearby').innerText(),/衣着：.*性情：/s);
    assert.doesNotMatch(await page.locator('#resident-nearby').innerText(),/。。|。；/);
    await act('worldgen:action.activity.0.0');
    const after=await snapshot(page,'after-activity');assert.ok(after.clock.totalMinutes>browsed.clock.totalMinutes);
  });
  await check('诊所提供实际可用的免费恢复；不依赖随机活动是否抽中',async()=>{
    const clinic=initial.worldInstance.definition.locations.find(l=>l.service==='clinic');await travelTo(clinic.id);
    const before=await snapshot(page,'before-clinic-care');await act('worldgen:action.care.'+clinic.id.split('.').at(-1));
    const after=await snapshot(page,'after-clinic-care');assert.equal(after.clock.totalMinutes,before.clock.totalMinutes+45);assert.equal(after.player.variables['core:money'],before.player.variables['core:money']);
    assert.ok(after.player.variables['core:health']>=before.player.variables['core:health']);
  });
  await check('认识居民后人物册立即保留身份、关系、日程与记忆，存档刷新完全恢复',async()=>{
    const target=initial.district.residents[0].locationId;await travelTo(target);const i=target.split('.').at(-1);await act('worldgen:action.look.'+i);
    if(await page.locator('#scene-mode').innerText()==='正在发生')await act(await page.locator('[data-action^="worldgen:action.event.leave."]').first().getAttribute('data-action'));
    await act('worldgen:action.talk.'+i);await act('worldgen:action.help.'+i);
    remembered=await snapshot();const n=remembered.district.residents.find(r=>r.id===remembered.district.currentResidentId);assert.ok(n.persistent);assert.ok(n.memories.length>=2);
    await click(page,'人物');assert.match(await page.locator('#people-content').innerText(),new RegExp(n.name));assert.match(await page.locator('#people-content').innerText(),/08:00/);await click(page,'关闭人物');
    await click(page,'存档');await click(page,'保存当前进度');await page.reload();await page.locator('#world-current').filter({hasText:worldName(42)}).waitFor({state:"attached"});assert.deepEqual(await snapshot(),remembered);
  });
  await check('更新参考库及加载新内容包不改当前世界，新世界实际包含扩展职业',async()=>{
    await click(page,'世界');await page.getByText('管理生成参考库',{exact:true}).click();
    await page.locator('#world-generation-content-import').setInputFiles(path.join(root,'content/generation/addon-content.json'));await page.locator('#world-message').filter({hasText:'校验通过'}).waitFor();
    await page.locator('#world-reference-import').setInputFiles(path.join(root,'content/generation/addon-reference.json'));await page.locator('#world-message').filter({hasText:'校验通过'}).waitFor();await click(page,'关闭世界');assert.deepEqual(await snapshot(),remembered);
    await click(page,'世界');await click(page,'生成并进入世界');const next=await snapshot(page,'addon-world');assert.ok(next.district.residents.some(r=>r.profession==='灯匠'));assert.equal(next.worldInstance.generation.contentPacks.length,initial.worldInstance.generation.contentPacks.length+1);
    await click(page,'存档');await page.locator('#save-import').setInputFiles(path.join(out,'fixed-initial.json'));await page.locator('#save-message').filter({hasText:'已导入'}).waitFor();assert.equal(await page.locator('#location-name').innerText(),'公寓');
    await page.locator('#save-import').setInputFiles(path.join(out,'current.json'));await page.locator('#save-message').filter({hasText:'已导入'}).waitFor();await click(page,'关闭存档');assert.deepEqual(await snapshot(),remembered);
    await page.screenshot({path:path.join(out,'desktop.png'),fullPage:true});
  });
  await check('进入固定测试世界后仍能读回生成存档，未保存切换不覆盖手动槽',async()=>{
    await click(page,'世界');await click(page,'开始固定以太都市测试世界');assert.equal(await page.locator('#location-name').innerText(),'公寓');await click(page,'存档');await click(page,'读取存档');await click(page,'关闭存档');assert.deepEqual(await snapshot(),remembered);
  });
  for(const seed of [7,42])await check(`种子${seed}独立HTML直接离线运行、行动、保存和刷新`,async()=>{
    const offline=await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:true});const requests=[];
    await offline.route(/^https?:/,r=>{requests.push(r.request().url());return r.abort();});const op=await offline.newPage();op.on('pageerror',e=>errors.push(e.message));
    await op.goto(pathToFileURL(path.join(root,`dist/WorldGenerator-Seed-${seed}.html`)).href);await op.locator('#world-current').filter({hasText:worldName(seed)}).waitFor({state:"attached"});
    await op.locator('[data-action="worldgen:action.rest.0"]').click();await op.waitForTimeout(300);const before=await snapshot(op,`offline-${seed}`);assert.equal(before.worldInstance.generation.seed,seed);
    await click(op,'存档');await click(op,'保存当前进度');await op.reload();await op.locator('#world-current').filter({hasText:worldName(seed)}).waitFor({state:"attached"});assert.deepEqual(await snapshot(op,`offline-${seed}-restored`),before);assert.deepEqual(requests,[]);await op.screenshot({path:path.join(out,`seed-${seed}.png`),fullPage:true});await offline.close();
  });
  assert.deepEqual(errors,[]);console.log(`World generator browser checks passed: ${results.length}`);
}catch(error){results.push({name:'failure',status:'failed',reason:error.stack??String(error)});console.error(error);process.exitCode=1;}
finally{await writeFile(path.join(out,'browser-results.json'),JSON.stringify({results,errors},null,2));if(browser)await browser.close();server.kill();}
