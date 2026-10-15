import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {enterFolio,openFolioPage,folioHome,performFolioAction} from './folio-navigation.mjs';

const out=path.resolve('artifacts/b-observations');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const errors=[],requests=[];
try{
  const context=await browser.newContext({viewport:{width:1360,height:1000},acceptDownloads:true});
  const page=await context.newPage();page.setDefaultTimeout(15000);
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  await page.goto(pathToFileURL(path.resolve('examples/B词条-现代街区.html')).href);
  await enterFolio(page);
  await page.locator('#scene-title').filter({hasText:'周围一瞥'}).waitFor();
  let serial=0;
  async function snapshot(){
    await openFolioPage(page,'save');const pending=page.waitForEvent('download');await page.locator('#save-export').click();
    const file=path.join(out,`browser-save-${++serial}.json`);await(await pending).saveAs(file);
    const state=JSON.parse(await readFile(file,'utf8')).payload.state;await folioHome(page);return state;
  }
  const initial=await snapshot();assert(initial.adventure.story.nodeId.startsWith('worldgen:node.observe.'));
  const body=await page.locator('#scene-text').innerText();assert.doesNotMatch(body,/undefined|TODO|暂无素材|的的/);
  await page.screenshot({path:path.join(out,'observation-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:path.join(out,'observation-mobile.png'),fullPage:true});
  await page.setViewportSize({width:1360,height:1000});
  await page.locator('#save-quick').click();await page.locator('#feedback').filter({hasText:'保存完成'}).waitFor();
  await page.reload();await enterFolio(page);await page.locator('#scene-title').filter({hasText:'周围一瞥'}).waitFor();
  assert.equal(await page.locator('#scene-text').innerText(),body);assert.deepEqual(await snapshot(),initial);
  await performFolioAction(page,'progression:action.story.0');assert(!(await page.locator('#feedback').evaluate(e=>e.classList.contains('error'))));
  const next=await snapshot();assert(next.adventure.story.nodeId.startsWith('worldgen:node.observe.'));
  await performFolioAction(page,'progression:action.story.1');
  const exited=await snapshot();assert.equal(exited.adventure.story,null);assert.deepEqual(exited.player,initial.player);assert.deepEqual(exited.district,initial.district);assert.deepEqual(exited.clock,initial.clock);
  const i=exited.worldInstance.definition.locations.findIndex(p=>p.id===exited.world.locationId);
  await performFolioAction(page,`worldgen:action.observe.${i}`);
  assert((await snapshot()).adventure.story.nodeId.startsWith('worldgen:node.observe.'));
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  await writeFile(path.join(out,'browser-report.json'),JSON.stringify({status:'passed',checks:['standalone offline entry displays installed B-content','desktop and mobile layout','save and reload preserve exact observation','next observation stays in its dedicated pool','free exit preserves resources, time and bodies','normal location action re-enters observations'],pageErrors:errors,externalRequests:requests},null,2)+'\n');
  console.log('B observations browser verification passed.');
}finally{await browser.close();}
