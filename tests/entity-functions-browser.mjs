import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {enterFolio,openFolioPage,folioHome,chooseFolioCard,performFolioAction} from './folio-navigation.mjs';

const out='artifacts/capability-batch',example=JSON.parse(await readFile(out+'/example.json','utf8'));
const checks=[],errors=[],requests=[];
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
async function fresh(){
  const context=await browser.newContext({viewport:{width:1280,height:1000},acceptDownloads:true});
  await context.route(/^https?:/,route=>{requests.push(route.request().url());return route.abort();});
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve('examples/首批NPC与地点功能示例.html')).href);await enterFolio(page);return page;
}
async function snapshot(page){
  // 动作入口有 250ms 防双击锁；等待一次提交结束后再请求导出。
  await page.waitForTimeout(300);
  await openFolioPage(page,'save');const pending=page.waitForEvent('download');await page.locator('#save-export').click();
  const downloaded=await pending,data=JSON.parse(await readFile(await downloaded.path(),'utf8'));await downloaded.delete();
  await page.locator('#save-export:not(:disabled)').waitFor();await page.locator('#page-home').click();return data.payload.state;
}
async function act(page,id){
  if(id.includes(':action.use.stock.'))await openFolioPage(page,'bag');
  await performFolioAction(page,id);
  assert.ok(!await page.locator('#feedback').evaluate(e=>e.classList.contains('error')),await page.locator('#feedback').textContent());
}
async function goTo(page,role){
  const start=(await snapshot(page)).world.locationId,queue=[[start,[]]],seen=new Set();let pathTo;
  while(queue.length){const [at,walk]=queue.shift();if(at===role.locationId){pathTo=walk;break;}if(seen.has(at))continue;seen.add(at);for(const route of example.routes.filter(r=>r.from===at))queue.push([route.to,[...walk,route]]);}
  assert.ok(pathTo);for(const route of pathTo)await act(page,route.actionId);
  const index=example.locations.findIndex(p=>p.id===role.locationId);
  for(let i=0;i<example.npcCount&&(await page.locator('#party-context h2').textContent())!==role.name;i++)await act(page,`worldgen:action.meet.${index}`);
  assert.equal(await page.locator('#party-context h2').textContent(),role.name);
  assert.equal((await snapshot(page)).district.currentResidentId,role.residentId);
}
const check=async(name,run)=>{await run();checks.push(name);console.log('PASS '+name);};
try{
  const smith=example.roles.find(r=>r.kind==='smith');
  await check('离线示例加载真实生成快照，铁匠仅显示自己的商品和训练',async()=>{
    const page=await fresh();assert.equal(await page.locator('#party-context h2').textContent(),smith.name);
    await chooseFolioCard(page,'progression:action.buy.blade');
    const group=page.locator('#actions .action-group[data-group="people"]');
    for(const option of smith.actions)assert.equal(await group.locator(`[data-action="${option.id}"]`).count(),1,option.label);
    assert.equal(await page.locator('#actions [data-action="progression:action.buy.staff"]').count(),0);
    assert.equal(await page.locator('#actions [data-action="progression:action.sleep"]').count(),0);
    assert.equal(await page.locator('#actions [data-action="progression:action.care"]').count(),0);
    await page.screenshot({path:'examples/首批功能示例.png',fullPage:true});await page.context().close();
  });
  await check('一次点击实际买入装备、训练提升能力、工作支付报酬并阻止当日重复',async()=>{
    const page=await fresh(),before=await snapshot(page);
    await chooseFolioCard(page,'progression:action.buy.blade');await page.locator('#actions [data-action="progression:action.buy.blade"]').click();
    const bought=await snapshot(page);assert.equal(bought.meta.revision,before.meta.revision+1);assert.equal(bought.player.variables['core:money'],before.player.variables['core:money']-25);assert.ok(bought.district.inventory.includes('progression:equipment.blade'));
    await act(page,'progression:action.train.attack');const trained=await snapshot(page);assert.equal(trained.player.variables['core:attack'],bought.player.variables['core:attack']+1);assert.equal(trained.player.variables['core:money'],bought.player.variables['core:money']-8);
    const work=smith.actions.find(a=>a.id.includes(':action.help.'));await act(page,work.id);const worked=await snapshot(page);assert.equal(worked.player.variables['core:money'],trained.player.variables['core:money']+3);
    await chooseFolioCard(page,work.id);assert.ok(await page.locator(`#actions [data-action="${work.id}"]`).isDisabled());
    await openFolioPage(page,'save');await page.locator('#save-write').click();await page.locator('#save-message').filter({hasText:'保存完成'}).waitFor();await page.reload();await enterFolio(page);assert.deepEqual(await snapshot(page),worked);
    await page.context().close();
  });
  await check('沿地图找到摊主，货单切换且干粮可真实购买使用',async()=>{
    const page=await fresh(),role=example.roles.find(r=>r.kind==='merchant');await goTo(page,role);
    const buy=role.actions.find(a=>a.label==='购买黑麦干粮'),before=await snapshot(page);await act(page,buy.id);const bought=await snapshot(page);
    assert.equal(bought.player.variables['core:money'],before.player.variables['core:money']-6);assert.equal(bought.adventure.items['fantasy:item.ration'],1);
    assert.equal(await page.locator('#actions [data-action="progression:action.train.attack"]').count(),0);
    await act(page,buy.id.replace('buy.stock.','use.stock.'));const used=await snapshot(page);assert.equal(used.adventure.items['fantasy:item.ration']??0,0);assert.equal(used.clock.totalMinutes,bought.clock.totalMinutes+5);await page.context().close();
  });
  await check('沿地图找到护理员，买入绷带可使用，护理设施提供治疗入口',async()=>{
    const page=await fresh(),role=example.roles.find(r=>r.kind==='healer');await goTo(page,role);
    const buy=role.actions.find(a=>a.label==='购买草药绷带'),before=await snapshot(page);await act(page,buy.id);const bought=await snapshot(page);
    assert.equal(bought.player.variables['core:money'],before.player.variables['core:money']-8);assert.equal(bought.adventure.items['fantasy:item.bandage'],1);
    await act(page,buy.id.replace('buy.stock.','use.stock.'));const used=await snapshot(page);assert.equal(used.adventure.items['fantasy:item.bandage']??0,0);assert.equal(used.clock.totalMinutes,bought.clock.totalMinutes+5);
    await folioHome(page);assert.equal(await page.locator('#actions [data-action="progression:action.sleep"]').count(),0);await page.context().close();
  });
  await check('路人只提供对话，交易、教学和打工完全不出现在页面或折叠栏',async()=>{
    const page=await fresh(),role=example.roles.find(r=>r.kind==='passerby');await goTo(page,role);await chooseFolioCard(page,role.actions[0].id);
    assert.equal(await page.locator('#actions [data-action*="action.buy."]').count(),0);assert.equal(await page.locator('#actions [data-action*="action.train."]').count(),0);assert.equal(await page.locator('#actions [data-action*="action.help."]').count(),0);
    assert.equal(await page.locator('#actions [data-action="progression:action.sleep"]').count(),1);
    await act(page,role.actions[0].id);assert.match(await page.locator('#scene-text').textContent(),/信|路|门|旅|行/);await page.context().close();
  });
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  await writeFile(out+'/browser-report.json',JSON.stringify({status:'passed',checks,errors,requests},null,2));
  console.log('Capability browser checks passed: '+checks.length);
}catch(error){await mkdir(out,{recursive:true});await writeFile(out+'/browser-report.json',JSON.stringify({status:'failed',checks,errors,requests,error:String(error)},null,2));console.error(error);process.exitCode=1;}finally{await browser.close();}
