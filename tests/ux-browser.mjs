import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const out=path.resolve('artifacts/ux-2026-10-12');await mkdir(out,{recursive:true});
const checks=[],errors=[];
const server=spawn(process.execPath,['scripts/serve.mjs','--built'],{env:{...process.env,PORT:'4196'},stdio:['ignore','pipe','pipe']});
let browser;
const check=async(name,run)=>{await run();checks.push(name);console.log('PASS '+name);};
try{
 await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('server timeout')),10000);server.stdout.on('data',d=>{if(String(d).includes('Aetheria Alpha')){clearTimeout(timeout);resolve();}});server.on('error',reject);});
 browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true}),page=await context.newPage();
 page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 const click=async selector=>{await page.locator(selector).first().click();await page.waitForTimeout(300);};
 const act=id=>click(`#play-page [data-action="${id}"]`);
 const stored=()=>page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('aetheria-alpha-0.1',1);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,q=db.transaction('slots','readonly').objectStore('slots').get('manual');q.onsuccess=()=>{db.close();resolve(JSON.parse(q.result).payload.state);};};}));
 await page.goto('http://localhost:4196/');await page.locator('#scene-title').filter({hasText:'公寓'}).waitFor();
 await check('快捷保存不跳页，菜单显示真实时间与保存状态，导出不冒充保存',async()=>{
  assert.equal(await page.locator('#save-state').innerText(),'尚未保存');await act('district:action.create');await click('#save-quick');assert.equal(await page.locator('#save-state').innerText(),'进度已保存');
  const before=await stored();await click('#body-open');assert.ok(await page.locator('#clock').isVisible());await click('#save-quick');assert.ok(await page.locator('#body-dialog').isVisible());assert.deepEqual(await stored(),before);
  await click('#story-resume');await act('aetheria:action.travel.apartment_street');assert.equal(await page.locator('#save-state').innerText(),'有未保存进度');await click('#save-open');const pending=page.waitForEvent('download');await click('#save-export');await(await pending).saveAs(path.join(out,'export-only.json'));assert.equal(await page.locator('#save-state').innerText(),'有未保存进度');assert.deepEqual(await stored(),before);await click('#story-resume');
 });
 await act('aetheria:action.travel.street_market');
 await check('行动显示公开耗时与资源变化，筛选只整理选项不改变进度',async()=>{
  const work=page.locator('#actions [data-action="aetheria:action.market.work"]');assert.match(await work.locator('.action-costs').innerText(),/30分钟/);assert.match(await work.locator('.action-costs').innerText(),/精力 −10/);
  await click('#save-quick');const before=await stored();await click('[data-action-filter="travel"]');assert.ok(await page.locator('#actions .action-group[data-group="travel"]').isVisible());assert.ok(!await page.locator('#actions .action-group[data-group="daily"]').isVisible());await click('#save-quick');assert.deepEqual(await stored(),before);await click('[data-action-filter="all"]');
 });
 await act('district:action.travel.workshop.out');await act('district:action.riker.meet');
 await check('剧情选择不混入地点筛选，查看人物后恢复相同对话与时钟',async()=>{
  assert.ok(!await page.locator('#action-filters').isVisible());const prose=await page.locator('#scene-text').innerText(),clock=await page.locator('#clock').innerText();
  await click('#save-quick');const before=await stored();await click('#people-nearby [data-npc-open]');await click('#people-dialog [data-close]');assert.ok(await page.locator('#play-page').isVisible());assert.equal(await page.locator('#scene-text').innerText(),prose);assert.equal(await page.locator('#clock').innerText(),clock);await click('#save-quick');assert.deepEqual(await stored(),before);
 });
 await act('district:action.event.riker.meet.start.0');
 await check('人物列表进入档案可返回列表，档案中的地图返回同一人物',async()=>{
  await click('#people-open');await click('#people-content .profile-open');await click('#people-dialog [data-close]');assert.equal(new URL(page.url()).hash,'#/people');await click('#story-home');assert.ok(await page.locator('#play-page').isVisible());
  await page.evaluate(()=>location.hash='#/people/missing%3Anpc');await page.locator('.profile-unavailable').waitFor();assert.match(await page.locator('.profile-unavailable').innerText(),/没有这个人物/);await click('#people-dialog [data-close]');assert.ok(await page.locator('#people-dialog').isVisible());await click('#story-resume');
  await click('#scene-return');await act('district:action.travel.workshop.back');await act('aetheria:action.travel.market_street');await click('#people-open');await click('#people-content .profile-open');const profileRoute=new URL(page.url()).hash;await click('#people-content [data-dialog-open="map"]');assert.ok(await page.locator('#map-dialog').isVisible());await click('#map-dialog [data-close]');assert.equal(new URL(page.url()).hash,profileRoute);await click('#story-resume');
 });
 await check('直接地址、浏览器后退和标题返回都切换页面，不执行游戏行动',async()=>{
  await click('#save-quick');const before=await stored();await page.evaluate(()=>location.hash='#/map');await page.locator('#map-dialog').waitFor();await click('#body-open');await page.goBack();await page.locator('#map-dialog').waitFor();await click('#story-home');assert.ok(await page.locator('#play-page').isVisible());await click('#save-quick');assert.deepEqual(await stored(),before);
 });
 await check('无效生成参数留在原世界并定位错误字段',async()=>{
  await click('#save-quick');const before=await stored();await click('#world-open');await page.locator('#world-size').fill('2');await click('#world-generate');assert.match(await page.locator('#world-message').innerText(),/有效/);assert.ok(await page.locator('#world-dialog').isVisible());assert.equal(await page.evaluate(()=>document.activeElement.id),'world-size');await click('#story-resume');await click('#save-quick');assert.deepEqual(await stored(),before);
 });
 await check('320至1440像素所有菜单无横向溢出，保存和返回入口可见',async()=>{
  for(const width of [320,360,390,768,1024,1440]){await page.setViewportSize({width,height:900});for(const name of ['map','body','people','save','log','quest','bag','discovery','pack','world']){await click(`#${name}-open`);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px ${name}`);assert.ok(await page.locator('#save-quick').isVisible());assert.ok(await page.locator('#clock').isVisible());await click('#story-resume');}if(width===390)await page.screenshot({path:path.join(out,'mobile-story.png'),fullPage:true});}
  await page.screenshot({path:path.join(out,'desktop-story.png'),fullPage:true});await click('#people-open');await click('#people-content .profile-open');await page.screenshot({path:path.join(out,'desktop-profile.png'),fullPage:true});
 });
 await check('离线生成居民档案没有空列表提示，快捷保存刷新后恢复',async()=>{
  const offline=await browser.newContext({viewport:{width:390,height:844}}),op=await offline.newPage();const requests=[];await offline.route(/^https?:/,r=>{requests.push(r.request().url());return r.abort();});op.on('pageerror',e=>errors.push(e.message));await op.goto(pathToFileURL(path.resolve('dist/WorldGenerator-Seed-42.html')).href);await op.locator('#location-name').filter({hasText:/./}).waitFor();await op.locator('[data-action="worldgen:action.meet.0"]').first().click();await op.waitForTimeout(300);await op.locator('#resident-nearby [data-npc-open]').click();assert.ok(await op.locator('#people-content [data-npc]:visible').count());assert.doesNotMatch(await op.locator('#people-content').innerText(),/还没有正式结识/);await op.locator('#save-quick').click();await op.waitForTimeout(500);assert.equal(await op.locator('#save-state').innerText(),'进度已保存');const title=await op.locator('#people-content [data-npc]:visible h3').innerText();await op.reload();await op.locator('#save-state').filter({hasText:'进度已保存'}).waitFor();assert.equal(await op.locator('#people-content [data-npc]:visible h3').innerText(),title);assert.deepEqual(requests,[]);await op.screenshot({path:path.join(out,'mobile-resident.png'),fullPage:true});await offline.close();
 });
 assert.deepEqual(errors,[]);
 await writeFile(path.join(out,'report.json'),JSON.stringify({status:'passed',checks,errors},null,2));
}catch(error){await writeFile(path.join(out,'report.json'),JSON.stringify({status:'failed',checks,errors,error:String(error)},null,2));console.error(error);process.exitCode=1;}finally{await browser?.close();server.kill();}
