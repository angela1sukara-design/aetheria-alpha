import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadPacks } from '../src/content/loader.ts';
import { createGameState } from '../src/engine/state.ts';
import { SaveCodec } from '../src/persistence/codec.ts';

const out=path.resolve('artifacts/adventure-browser');await mkdir(out,{recursive:true});
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const index=await json('content/index.json'),inputs=await Promise.all(index.packs.map(p=>json('content/'+p))),registry=await loadPacks(inputs),codec=new SaveCodec(registry);
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const results=[],errors=[],requests=[];let serial=0;
const url=pathToFileURL(path.resolve('dist/Aetheria-Alpha-0.2.html')).href;
async function fresh(){
  const context=await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:true});
  await context.route(/^https?:/,route=>{requests.push(route.request().url());return route.abort();});
  const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.locator('#location-name').filter({hasText:'公寓'}).waitFor({state:'attached'});return page;
}
async function home(page){if(await page.locator('#subpage-host').isVisible())await page.locator('#page-home').click();}
async function act(page,id){
  await home(page);if(await page.locator('#scene-return').isVisible())await page.locator('#scene-return').click();
  const button=page.locator(`#play-page button[data-action="${id}"]`).first();
  if(!await button.isVisible())for(const summary of await page.locator('#actions .locked-actions:not([open]) > summary').all())await summary.click();
  await button.click();await page.waitForTimeout(300);
  assert.ok(!await page.locator('#feedback').evaluate(e=>e.classList.contains('error')),await page.locator('#feedback').innerText());
}
async function fixture(page,location,change=()=>{}){
  const state=createGameState(registry,42);state.world.locationId=location;if(!state.world.knownLocationIds.includes(location))state.world.knownLocationIds.push(location);change(state);
  const file=path.join(out,'fixture-'+ ++serial+'.json');await writeFile(file,await codec.encode(state));
  await home(page);await page.locator('#save-open').click();await page.locator('#save-import').setInputFiles(file);
  await page.locator('#save-message').filter({hasText:'已导入到当前游戏'}).waitFor();await home(page);
}
async function snapshot(page){
  await home(page);await page.locator('#save-open').click();const pending=page.waitForEvent('download');await page.locator('#save-export').click();
  const file=path.join(out,'snapshot-'+ ++serial+'.json');await(await pending).saveAs(file);await home(page);return(await json(file)).payload.state;
}
async function saveReload(page){await home(page);await page.locator('#save-quick').click();await page.locator('#feedback').filter({hasText:'保存完成'}).waitFor();await page.reload();await page.locator('#feedback').filter({hasText:'已恢复手动存档'}).waitFor();}
async function check(name,fn){await fn();results.push({name,status:'passed'});console.log('PASS '+name);}
try{
  const page=await fresh();
  await check('零体力与零行动点交锋保存刷新后仍可紧急撤离',async()=>{
    await fixture(page,'aetheria:location.market',s=>{s.player.variables['core:stamina']=0;s.player.variables['core:actionPoints']=0;});
    await act(page,'progression:action.challenge.gel');await saveReload(page);
    assert.ok(await page.locator('#play-page [data-action="district:action.combat.flee"]').isEnabled());await act(page,'district:action.combat.flee');
    assert.equal((await snapshot(page)).district.combat,null);
  });
  await check('战败进入带Tag的分支，保存刷新不重抽节点，免费退出恢复行动',async()=>{
    await fixture(page,'aetheria:location.market',s=>{s.player.variables['core:health']=1;s.player.variables['core:defense']=0;});
    await act(page,'progression:action.challenge.gel');for(let i=0;i<10&&!(await snapshot(page)).adventure.story;i++)await act(page,'district:action.combat.guard');
    await act(page,'progression:action.story.0');assert.match(await page.locator('#scene-text').innerText(),/【外衣黏附】/);
    const before=await snapshot(page),text=await page.locator('#scene-text').innerText();await saveReload(page);
    assert.equal(await page.locator('#scene-text').innerText(),text);assert.deepEqual(await snapshot(page),before);
    await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:path.join(out,'defeat-mobile.png'),fullPage:true});await page.setViewportSize({width:1280,height:900});
    await act(page,'progression:action.story.2');const after=await snapshot(page);assert.equal(after.adventure.story,null);assert.ok(after.player.variables['core:health']>=1);
  });
  await check('训练限制、购买及武器护甲叠加实际生效；技能消耗SR且战斗记录保持三段',async()=>{
    await fixture(page,'district:location.workshop',s=>{s.player.variables['core:money']=200;});
    await act(page,'progression:action.train.attack');await act(page,'progression:action.train.attack');
    assert.ok(await page.locator('#play-page [data-action="progression:action.train.attack"]').isDisabled());
    for(const id of ['buy.blade','buy.vest','wear.blade','wear.vest'])await act(page,'progression:action.'+id);
    await act(page,'progression:action.challenge.raider');assert.match(await page.locator('#scene-text').innerText(),/攻击15；防御13/);
    assert.match(await page.locator('#scene-text').innerText(),/我方Tag：[\s\S]*敌方Tag：【直接倾向】【结束接触目标】/);
    await act(page,'progression:action.combat.skill');assert.equal((await snapshot(page)).player.variables['core:skillResource'],90);
    assert.match(await page.locator('#scene-text').innerText(),/状态[\s\S]*行动[\s\S]*造成效果/);
    assert.equal(await page.locator('#scene-text p').last().evaluate(e=>getComputedStyle(e).whiteSpace),'pre-line');
    await page.screenshot({path:path.join(out,'combat-desktop.png'),fullPage:true});
  });
  await check('订单、投资、跨日收益与每日次数在实际界面结算',async()=>{
    await fixture(page,'aetheria:location.market',s=>{s.player.variables['core:money']=100;});
    for(let i=0;i<3;i++)await act(page,'progression:action.order');assert.ok(await page.locator('#play-page [data-action="progression:action.order"]').isDisabled());
    await act(page,'progression:action.invest');const before=await snapshot(page);await act(page,'progression:action.sleep');
    const after=await snapshot(page);assert.equal(after.player.variables['core:money'],before.player.variables['core:money']+10);
    await act(page,'progression:action.order');assert.match(await page.locator('#adventure-status').innerText(),/经营份额 6/);
  });
  await check('故事付费选项展示消耗提示，退出保留免费提示',async()=>{
    await fixture(page,'aetheria:location.market');await act(page,'progression:action.narrative.daily');
    assert.match(await page.locator('#play-page [data-action="progression:action.story.0"]').innerText(),/行动消耗/);
    assert.match(await page.locator('#play-page [data-action="progression:action.story.1"]').innerText(),/无资源费用/);
    const before=await snapshot(page);await act(page,'progression:action.story.0');const after=await snapshot(page);
    assert.equal(after.player.variables['core:stamina'],before.player.variables['core:stamina']-4);assert.equal(after.adventure.safety,1);
  });
  const preferences=await fresh();
  await check('文本扩展禁用和重新启用均跨刷新保留',async()=>{
    await preferences.locator('#pack-open').click();await preferences.locator('#pack-import').setInputFiles(path.resolve('content/author-example/text-pack.json'));
    const toggle=preferences.locator('[data-pack="author-example/quiet"][data-pack-move="toggle"]');await toggle.waitFor();await toggle.click();
    assert.match(await preferences.locator('#pack-content').innerText(),/已禁用/);await preferences.reload();await preferences.locator('#pack-open').click();
    assert.match(await preferences.locator('#pack-content').innerText(),/已禁用/);await toggle.click();await preferences.reload();await preferences.locator('#pack-open').click();
    assert.match(await preferences.locator('#pack-content').innerText(),/已启用/);
  });
  await check('不兼容规则扩展被隔离，城市仍启动且原文保留',async()=>{
    const bad=structuredClone(inputs.at(-1));bad.manifest.id='broken/extension';bad.manifest.dependencies[0].version='999.0.0';
    await preferences.evaluate(raw=>localStorage.setItem('aetheria-alpha02-rules',JSON.stringify([raw])),bad);await preferences.reload();
    await preferences.locator('#location-name').filter({hasText:'公寓'}).waitFor({state:'attached'});await preferences.locator('#pack-open').click();
    assert.match(await preferences.locator('#extension-recovery').innerText(),/隔离的规则扩展/);
    assert.deepEqual(await preferences.evaluate(()=>JSON.parse(localStorage.getItem('aetheria-alpha02-rules'))),[bad]);
  });
  await check('新增流程无浏览器异常，独立HTML不请求网络',async()=>{assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);});
}catch(error){results.push({name:'failure',status:'failed',reason:error.stack??String(error)});console.error(error);process.exitCode=1;}
finally{await writeFile(path.join(out,'results.json'),JSON.stringify({results,errors,requests},null,2)+'\n');await browser.close();}
