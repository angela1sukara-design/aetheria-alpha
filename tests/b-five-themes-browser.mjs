import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {enterFolio,openFolioPage,folioHome,performFolioAction} from './folio-navigation.mjs';
import {B_FIVE_THEME_OBSERVATIONS} from '../src/world/b-five-theme-data.ts';
const out=path.resolve('artifacts/b-five-themes');await mkdir(out,{recursive:true});
const manifest=JSON.parse(await readFile(path.join(out,'installation.json'),'utf8'));
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const errors=[],requests=[],results=[];
try{
  for(const fixture of manifest.examples){
    const context=await browser.newContext({viewport:{width:1360,height:1000},acceptDownloads:true});
    const page=await context.newPage();page.setDefaultTimeout(15000);
    page.on('pageerror',e=>errors.push({theme:fixture.theme,error:e.message}));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
    await page.goto(pathToFileURL(path.resolve(fixture.example)).href);await enterFolio(page);
    await page.locator('#scene-title').filter({hasText:'周围一瞥'}).waitFor();
    let serial=0;
    async function snapshot(){
      await openFolioPage(page,'save');const pending=page.waitForEvent('download');await page.locator('#save-export').click();
      const file=path.join(out,`browser-${fixture.theme}-${++serial}.json`);await(await pending).saveAs(file);
      const state=JSON.parse(await readFile(file,'utf8')).payload.state;await folioHome(page);return state;
    }
    const body=await page.locator('#scene-text').innerText();assert.equal(body.trim(),fixture.initialText.trim());
    assert.doesNotMatch(body,/undefined|TODO|暂无素材|的的/);
    const initial=await snapshot();assert.equal(initial.worldInstance.definition.setting.tag,'worlds:setting.'+fixture.theme);
    await page.screenshot({path:path.join(out,fixture.theme+'-desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:path.join(out,fixture.theme+'-mobile.png'),fullPage:true});await page.setViewportSize({width:1360,height:1000});
    await page.locator('#save-quick').click();await page.locator('#feedback').filter({hasText:'保存完成'}).waitFor();
    await page.reload();await enterFolio(page);await page.locator('#scene-title').filter({hasText:'周围一瞥'}).waitFor();
    assert.equal(await page.locator('#scene-text').innerText(),body);assert.deepEqual(await snapshot(),initial);
    await performFolioAction(page,'progression:action.story.0');assert(!(await page.locator('#feedback').evaluate(e=>e.classList.contains('error'))));
    assert((await snapshot()).adventure.story.nodeId.startsWith('worldgen:node.observe.'));
    await performFolioAction(page,'progression:action.story.1');const exited=await snapshot();assert.equal(exited.adventure.story,null);
    assert.deepEqual(exited.player,initial.player);assert.deepEqual(exited.district,initial.district);assert.deepEqual(exited.clock,initial.clock);
    const i=exited.worldInstance.definition.locations.findIndex(p=>p.id===exited.world.locationId);
    await performFolioAction(page,`worldgen:action.observe.${i}`);assert((await snapshot()).adventure.story.nodeId.startsWith('worldgen:node.observe.'));
    results.push({theme:fixture.theme,status:'passed',initialEntryId:fixture.initialEntryId,desktopAndMobile:true,saveReloadExact:true,freeExit:true,normalLocationEntry:true});
    await context.close();
  }
  // Also generate the five worlds inside the updated official offline game.
  const officialContext=await browser.newContext({viewport:{width:1360,height:1000},acceptDownloads:true});
  const official=await officialContext.newPage();official.setDefaultTimeout(20000);
  official.on('pageerror',e=>errors.push({theme:'official',error:e.message}));official.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  await official.goto(pathToFileURL(path.resolve('启动游戏-双击直接运行.html')).href);await enterFolio(official);
  const generated=[];
  for(const fixture of manifest.examples){
    await openFolioPage(official,'world');await official.locator('#world-theme').selectOption('worlds:setting.'+fixture.theme);
    await official.locator('#world-seed').fill('42');await official.locator('#world-generate').click();
    await official.locator('#world-dialog').waitFor({state:'hidden'});
    if(await official.locator('#character-intro').isVisible())await performFolioAction(official,'district:action.create');
    await performFolioAction(official,'worldgen:action.observe.0');await official.locator('#scene-title').filter({hasText:'周围一瞥'}).waitFor();
    await openFolioPage(official,'save');const pending=official.waitForEvent('download');await official.locator('#save-export').click();
    const saveFile=path.join(out,'official-'+fixture.theme+'.json');await(await pending).saveAs(saveFile);
    const state=JSON.parse(await readFile(saveFile,'utf8')).payload.state;assert.equal(state.worldInstance.definition.setting.tag,'worlds:setting.'+fixture.theme);
    const pack=state.worldInstance.definition.packs.find(p=>p.manifest.id==='generated/neighborhood');
    const nodes=pack.narrativeNodes.filter(n=>n.id.startsWith('worldgen:node.observe.'));
    assert(nodes.some(n=>B_FIVE_THEME_OBSERVATIONS.some(r=>r.theme===fixture.theme&&pack.texts[n.textKey].includes(r.context+'。'+r.fragments.join('')))));
    await folioHome(official);await performFolioAction(official,'progression:action.story.1');
    generated.push({theme:fixture.theme,status:'passed',observationNodes:nodes.length});
  }
  await officialContext.close();
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  await writeFile(path.join(out,'browser-report.json'),JSON.stringify({status:'passed',results,officialOfflineGeneration:generated,pageErrors:errors,externalRequests:requests},null,2)+'\n');
  console.log('Five-theme browser verification passed: 5 worlds, offline display, mobile layout, save/reload, free exit and normal entry.');
}finally{await browser.close();}
