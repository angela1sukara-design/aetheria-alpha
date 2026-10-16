import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {loadPacks} from '../src/content/loader.ts';
import {WorldGenerator} from '../src/world/generator.ts';
import {SaveCodec} from '../src/persistence/codec.ts';
import {enterFolio,openFolioPage,folioHome,performFolioAction as act} from './folio-navigation.mjs';
const j=async f=>JSON.parse(await readFile(f,'utf8')),index=await j('content/index.json');
const source=await loadPacks([...await Promise.all(index.packs.map(f=>j('content/'+f))),await j('content/personality/pack.json'),...await Promise.all(['neighborhood-content','lexicon-content','world-profile-content','fantasy-content','personality-dialogue-content'].map(f=>j('content/generation/'+f+'.json')))]);
const g=await new WorldGenerator().generate({registry:source,seed:42,rules:await j('content/generation/rules.json'),references:await Promise.all(['lexicon-reference','fantasy-reference'].map(f=>j('content/generation/'+f+'.json'))),worldProfiles:await j('content/generation/world-profiles.json'),worldTag:'worlds:setting.fantasy'});
const out=path.resolve('artifacts/gemini-content-2026-10-16/browser');await mkdir(out,{recursive:true});
const stage=g.registry.action('worldgen:action.personal.story.0.s0.enter'),where=stage.conditions.find(c=>c.op==='location.is').id,actor=stage.conditions.find(c=>c.op==='resident.present').residentId;
// Established-acquaintance fixture, then every story/commission step uses UI intents.
const fixture=structuredClone(g.state);fixture.world.locationId=where;if(!fixture.world.knownLocationIds.includes(where))fixture.world.knownLocationIds.push(where);fixture.district.currentResidentId=actor;fixture.district.profile.created=true;fixture.district.residents.find(n=>n.id===actor).trust=2;
const fixtureFile=path.join(out,'established-acquaintance.json');await writeFile(fixtureFile,await new SaveCodec(g.registry).encode(fixture));
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}),errors=[],requests=[],checks=[];
try{
 const context=await browser.newContext({viewport:{width:1360,height:1000},acceptDownloads:true}),page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
 await page.goto(pathToFileURL(path.resolve('启动游戏-双击直接运行.html')).href);await enterFolio(page);
 // Prove the official new-world path also installs the author deliveries.
 await openFolioPage(page,'world');await page.locator('#world-theme').selectOption('worlds:setting.fantasy');await page.locator('#world-seed').fill('42');await page.locator('#world-generate').click();await page.locator('#world-dialog').waitFor({state:'hidden'});
 let serial=0;async function snapshot(){await openFolioPage(page,'save');const pending=page.waitForEvent('download');await page.locator('#save-export').click();const file=path.join(out,'state-'+ ++serial+'.json');await(await pending).saveAs(file);const s=(await j(file)).payload.state;await folioHome(page);return s;}
 const fresh=await snapshot();assert.equal(fresh.worldInstance.definition.packs.find(p=>p.manifest.id==='generated/neighborhood').events.filter(e=>/event.personal.job.\d.offer$/.test(e.id)).length,6);checks.push('official fantasy new world contains all six real commission offers');
 await openFolioPage(page,'save');await page.locator('#save-import').setInputFiles(fixtureFile);await page.locator('#save-message').filter({hasText:'已导入'}).waitFor();await folioHome(page);
 assert.equal(await page.locator('#actions [data-action="worldgen:action.personal.story.0.s1.enter"]').count(),0,'future chapter hidden');
 for(let s=0;s<4;s++){
  if(s){const wait=await page.locator('#actions [data-action^="worldgen:action.personal.waitday."]').first().getAttribute('data-action');await act(page,wait);}
  await act(page,`worldgen:action.personal.story.0.s${s}.enter`);assert.doesNotMatch(await page.locator('#scene-text').innerText(),/【人物】|【地点】/);await act(page,`worldgen:action.personal.story.0.s${s}.0`);
  if(s===0){const before=await snapshot();await page.locator('#save-quick').click();await page.locator('#feedback').filter({hasText:'保存完成'}).waitFor();await page.reload();await enterFolio(page);assert.deepEqual(await snapshot(),before);const next=page.locator('#actions [data-action="worldgen:action.personal.story.0.s1.enter"]');assert.equal(await next.count(),1);assert(await next.isDisabled(),'same-day chapter cannot advance');checks.push('chapter saves exactly, same-day gate locks, future chapters stay hidden');}
 }
 assert((await snapshot()).player.flags['worldgen:flag.personal.story.0.s3.c0']);await act(page,'worldgen:action.personal.story.0.ending.0.enter');await page.screenshot({path:path.join(out,'story-ending.png'),fullPage:true,animations:'disabled'});await act(page,'worldgen:action.personal.story.0.ending.0.exit');checks.push('four real chapters reach an explicit ending and repeatable epilogue');
 async function walk(target){const state=await snapshot(),queue=[[state.world.locationId,[]]],seen=new Set();while(queue.length){const [at,routes]=queue.shift();if(at===target){for(const routeId of routes){const a=g.registry.contentPacks.flatMap(p=>p.actions).find(a=>a.effects.some(e=>e.op==='location.move'&&e.routeId===routeId));await act(page,a.id);}return;}if(seen.has(at))continue;seen.add(at);for(const r of g.registry.routes.filter(r=>r.from===at))queue.push([r.to,[...routes,r.id]]);}throw Error('No route');}
 await act(page,'worldgen:action.personal.job.0.offer.enter');await act(page,'worldgen:action.personal.job.0.offer.0');assert.equal(await page.locator('#actions [data-action="worldgen:action.personal.job.0.submit.enter"]').count(),0);
 for(let s=0;s<2;s++){const a=g.registry.action(`worldgen:action.personal.job.0.step${s}.enter`);await walk(a.conditions.find(c=>c.op==='location.is').id);await act(page,a.id);await act(page,`worldgen:action.personal.job.0.step${s}.0`);}
 await walk(where);await act(page,'worldgen:action.personal.job.0.submit.enter');const before=await snapshot();await act(page,'worldgen:action.personal.job.0.submit.0');const paid=await snapshot();assert.equal(paid.player.variables['core:money']-before.player.variables['core:money'],20);assert(paid.player.flags['worldgen:flag.personal.job.0.done']);assert.equal(await page.locator('#actions [data-action="worldgen:action.personal.job.0.submit.enter"]').count(),0);checks.push('commission requires actual travel/work and pays exactly once on submission');
 await openFolioPage(page,'quest');assert.match(await page.locator('#quest-content').innerText(),/委托已结算/);await folioHome(page);await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(out,'mobile-commission.png'),fullPage:true,animations:'disabled'});checks.push('journal reflects completed work, mobile stays within viewport');
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);await writeFile(path.join(out,'report.json'),JSON.stringify({status:'passed',checks,pageErrors:errors,externalRequests:requests},null,2)+'\n');console.log('Personal content browser passed: '+checks.length+' checks');
}finally{await browser.close();}
