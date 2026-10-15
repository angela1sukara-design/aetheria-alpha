import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {enterFolio,openFolioPage,folioHome,performFolioAction} from './folio-navigation.mjs';
const out=path.resolve('artifacts/a-templates');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const errors=[],requests=[],checks=[];
try{
 const context=await browser.newContext({viewport:{width:1360,height:1000},acceptDownloads:true}),page=await context.newPage();page.setDefaultTimeout(20000);
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
 let serial=0;
 async function snapshot(){await openFolioPage(page,'save');const pending=page.waitForEvent('download');await page.locator('#save-export').click();const file=path.join(out,`browser-${++serial}.json`);await(await pending).saveAs(file);const state=JSON.parse(await readFile(file,'utf8')).payload.state;await folioHome(page);return state;}
 await page.goto(pathToFileURL(path.resolve('examples/A模板-实际游戏.html')).href);await enterFolio(page);
 let initial=await snapshot();assert.equal(initial.adventure.story.prose.mode,'assembled');assert.match(initial.adventure.story.prose.ruleId,/assembly\.(01|03|05)\./);
 const body=await page.locator('#scene-text').innerText();assert(body.includes(initial.adventure.story.prose.text));
 await page.screenshot({path:path.join(out,'environment-desktop.png'),fullPage:true,animations:'disabled'});await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(out,'environment-mobile.png'),fullPage:true,animations:'disabled'});await page.setViewportSize({width:1360,height:1000});
 await page.locator('#save-quick').click();await page.locator('#feedback').filter({hasText:'保存完成'}).waitFor();await page.reload();await enterFolio(page);assert.equal(await page.locator('#scene-text').innerText(),body);assert.deepEqual(await snapshot(),initial);
 await performFolioAction(page,'progression:action.story.0');assert.equal((await snapshot()).adventure.story.prose.mode,'assembled');await performFolioAction(page,'progression:action.story.1');
 checks.push('environment: live assembly, mobile layout, exact save/reload, continue and exit');
 await performFolioAction(page,'worldgen:action.a-person.0');const person=await snapshot();assert.equal(person.adventure.story.prose.mode,'assembled');assert.equal(person.adventure.story.actor.kind,'resident');assert(person.adventure.story.prose.context.bindings.actor.subject.includes(person.adventure.story.actor.id));
 await page.screenshot({path:path.join(out,'person-desktop.png'),fullPage:true,animations:'disabled'});await performFolioAction(page,'progression:action.story.1');checks.push('person: actual present resident, own schedule and bindings');
 await performFolioAction(page,'worldgen:action.a-body.0');const before=await snapshot();assert.equal(before.adventure.story.prose.mode,'assembled');assert.equal(before.adventure.story.actor.kind,'player');assert.equal(before.adventure.story.prose.context.bindings.part.subject,'player');
 await page.screenshot({path:path.join(out,'body-desktop.png'),fullPage:true,animations:'disabled'});
 await openFolioPage(page,'body');await performFolioAction(page,'aetheria-tf:action.free.ears.cat');await folioHome(page);const transformed=await snapshot();assert.notDeepEqual(transformed.player.body,before.player.body);assert.deepEqual(transformed.adventure.story.prose,before.adventure.story.prose);
 const captured=await page.locator('#scene-text').innerText();await page.locator('#save-quick').click();await page.locator('#feedback').filter({hasText:'保存完成'}).waitFor();await page.reload();await enterFolio(page);assert.equal(await page.locator('#scene-text').innerText(),captured);assert.deepEqual((await snapshot()).adventure.story.prose,before.adventure.story.prose);
 await performFolioAction(page,'progression:action.story.0');const after=await snapshot();assert.equal(after.adventure.story.prose.mode,'assembled');assert(after.player.body.parts.some(p=>p.instanceId===after.adventure.story.prose.context.bindings.part.instanceId));await performFolioAction(page,'progression:action.story.1');checks.push('body: actual player part/material, TF preserves captured prose, next observation reads new state');
 // Generate through the official UI, rather than relying only on a prepared fixture.
 await context.clearCookies();await page.goto(pathToFileURL(path.resolve('启动游戏-双击直接运行.html')).href);await enterFolio(page);
 for(const theme of ['modern','cyberpunk','fantasy','xianxia','post-apocalypse']){
  await openFolioPage(page,'world');await page.locator('#world-theme').selectOption('worlds:setting.'+theme);await page.locator('#world-seed').fill('42');await page.locator('#world-generate').click();await page.locator('#world-dialog').waitFor({state:'hidden'});
  if(await page.locator('#character-intro').isVisible())await performFolioAction(page,'district:action.create');
  for(const mode of ['environment','person','body']){
   await performFolioAction(page,`worldgen:action.a-${mode}.0`);const state=await snapshot();assert(state.adventure.story.prose);assert.equal(state.worldInstance.definition.setting.tag,'worlds:setting.'+theme);
   if(mode!=='person')assert.equal(state.adventure.story.prose.mode,'assembled');
   const pack=state.worldInstance.definition.packs.find(p=>p.manifest.id==='generated/neighborhood');assert.equal(pack.narrativeNodes.filter(n=>n.proseAssembly).length,54);
   await performFolioAction(page,'progression:action.story.1');
  }
  checks.push(theme+': all three live template entries generated inside official offline game');
 }
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);await writeFile(path.join(out,'browser-report.json'),JSON.stringify({status:'passed',checks,pageErrors:errors,externalRequests:requests},null,2)+'\n');console.log('A templates browser checks passed: three live modes, exact saves, TF, five official worlds and offline/mobile operation.');
}finally{await browser.close();}
