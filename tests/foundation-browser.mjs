import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { clickUI } from './ui-navigation.mjs';

const out=path.resolve('artifacts/foundation-v04/browser');await mkdir(out,{recursive:true});
const results=[],errors=[],requests=[];
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const context=await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:true});
await context.route(/^https?:/,route=>{requests.push(route.request().url());return route.abort();});
const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
const click=name=>clickUI(page,name,true);
// 与界面已有的 250ms 防重复提交窗口保持一致，避免下一次独立操作被当成双击。
const act=async id=>{await page.locator(`[data-action="${id}"]`).first().click();await page.waitForTimeout(300);assert.ok(!await page.locator('#feedback').evaluate(e=>e.classList.contains('error')),await page.locator('#feedback').innerText());};
const snapshot=async name=>{await click('存档');const pending=page.waitForEvent('download');await click('导出 JSON');const file=path.join(out,name+'.json');await(await pending).saveAs(file);await click('关闭存档');return JSON.parse(await readFile(file,'utf8')).payload.state;};
const check=async(name,run)=>{await run();results.push({name,status:'passed'});console.log('PASS '+name);};
try{
  await page.goto(pathToFileURL(path.resolve('dist/WorldGenerator-Seed-7.html')).href);await page.locator('#world-current').filter({hasText:'种子 7'}).waitFor({state:'attached'});
  await check('离线街区通过原身体面板修改真实尾部参数并筛出尺寸正文',async()=>{
    await click('身体');await act('aetheria-tf:action.free.tail.organic');await act('foundation:action.tail-length');
    assert.match(await page.locator('#body-content').innerText(),/转身空间/);await page.locator('.body-details summary').click();assert.match(await page.locator('#body-content').innerText(),/650 毫米/);await page.screenshot({path:path.join(out,'tail-650.png'),fullPage:true});await click('关闭身体');
  });
  let expected;
  await check('真实光照开关更新地点观察并阻止需要照明的活动，读取不推进时钟或随机流',async()=>{
    const before=await snapshot('before-light');await act('worldgen:action.light.off.0');
    await page.locator('#scene-return').click();await page.locator('#location-review').click();assert.match(await page.locator('#location-description').innerText(),/熄灭/);
    const state=await snapshot('after-light');assert.deepEqual(state.clock,before.clock);assert.deepEqual(state.rng,before.rng);assert.equal(state.environment[state.world.locationId].light,'dark');
    const pack=state.worldInstance.definition.packs.find(p=>p.manifest.id==='generated/neighborhood');const activity=pack.actions.find(a=>a.id.startsWith('worldgen:action.activity.0.')&&a.conditions.some(c=>c.op==='environment.light'));assert.ok(activity);assert.ok(await page.locator(`[data-action="${activity.id}"]`).first().isDisabled());expected=state;
  });
  await check('离线保存刷新恢复参数、光照、阶段与账本；390px 可操作且无外部请求',async()=>{
    await click('存档');await click('保存当前进度');await page.reload();await page.locator('#world-current').filter({hasText:'种子 7'}).waitFor({state:'attached'});assert.deepEqual(await snapshot('restored'),expected);
    await page.setViewportSize({width:390,height:844});await click('身体');assert.match(await page.locator('#body-content').innerText(),/转身空间/);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(out,'mobile.png'),fullPage:true});assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);
  });
}catch(error){results.push({name:'failure',status:'failed',reason:error.stack??String(error)});console.error(error);process.exitCode=1;}
finally{await writeFile(path.join(out,'results.json'),JSON.stringify({results,errors,requests},null,2)+'\n');await browser.close();}
