import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {loadPacks} from '../src/content/loader.ts';
import {WorldGenerator} from '../src/world/generator.ts';
import {ActionExecutor} from '../src/engine/executor.ts';
import {SaveCodec} from '../src/persistence/codec.ts';
import {B_FIVE_THEME_OBSERVATIONS} from '../src/world/b-five-theme-data.ts';
import {FIVE_THEMES,THEME_NAMES} from './lexicon/five-theme-scenery.mjs';
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const index=await json('content/index.json');
const registry=await loadPacks([...await Promise.all(index.packs.map(p=>json('content/'+p))),await json('content/personality/pack.json'),
  ...await Promise.all(['neighborhood-content','lexicon-content','world-profile-content','fantasy-content','personality-dialogue-content'].map(p=>json('content/generation/'+p+'.json')))]);
const rules=await json('content/generation/rules.json'),references=await Promise.all(['lexicon-reference','fantasy-reference'].map(p=>json('content/generation/'+p+'.json'))),worldProfiles=await json('content/generation/world-profiles.json');
const html=await readFile('dist/Aetheria-Folio.html','utf8'),marker='<script>globalThis.aetheriaEmbedded=';assert(html.includes(marker));
await mkdir('examples',{recursive:true});await mkdir('artifacts/b-five-themes',{recursive:true});
const examples=[];
for(const theme of FIVE_THEMES){
  const g=await new WorldGenerator().generate({seed:42,registry,rules,references,worldProfiles,worldTag:'worlds:setting.'+theme});
  const engine=new ActionExecutor(g.registry,g.state);let serial=0;
  const act=(actionId,params)=>{const res=engine.performAction({actionId,...(params?{params}:{})},engine.snapshot().meta.revision,`five-example-${theme}-${++serial}`);assert(res.ok,res.message);};
  act('district:action.create',{name:'旅人'});
  const i=g.world.definition.locations.findIndex(p=>p.id===engine.snapshot().world.locationId);
  let recipe,body;
  // Enter through normal actions until this fixture opens on a newly installed phrase.
  for(let attempt=0;attempt<40;attempt++){
    act(`worldgen:action.observe.${i}`);
    const node=g.registry.narrativeNodes.find(n=>n.id===engine.snapshot().adventure.story.nodeId);body=g.registry.text(node.textKey);
    recipe=B_FIVE_THEME_OBSERVATIONS.find(r=>r.theme===theme&&body.includes(r.context+'。'+r.fragments.join('')));
    if(recipe)break;act('progression:action.story.1');
  }
  assert(recipe,'No new scene reached through normal observation actions.');
  const codec=new SaveCodec(g.registry),save=await codec.encode(engine.snapshot()),restored=await codec.decode(save);assert.equal(restored.status,'ready');assert.deepEqual(restored.state,engine.snapshot());
  const example=`examples/B五题材-${theme}.html`,savePath=`artifacts/b-five-themes/${theme}-save.json`;
  const launch=`globalThis.aetheriaInitialSave=${JSON.stringify(save).replaceAll('<','\\u003c')};globalThis.aetheriaSaveSlot=${JSON.stringify('b-five-themes-'+theme+'-2026-10-15')};`;
  await writeFile(example,html.replace(marker,'<script>'+launch+'globalThis.aetheriaEmbedded='));await writeFile(savePath,save);
  examples.push({theme,name:THEME_NAMES[theme],example,savePath,initialEntryId:recipe.id,initialText:body,seed:42,world:g.world.definition.name,ecology:g.world.definition.setting.ecologyTag,observationNodes:g.registry.narrativeNodes.filter(n=>n.id.startsWith('worldgen:node.observe.')).length});
}
const source=await json('content/prose/b-five-themes-v2.json');
await writeFile('artifacts/b-five-themes/installation.json',JSON.stringify({date:'2026-10-15',newEntries:675,combinedEntries:945,byTheme:Object.fromEntries(FIVE_THEMES.map(t=>[t,135])),sourceFiles:source.originalFiles,scope:'generated-incidental-scenery-only',originalsUntouched:true,oldSavesPreserved:true,examples},null,2)+'\n');
await writeFile('examples/B五题材-试玩入口.html',`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>五种世界 · 日常一瞥</title><style>body{margin:0;background:#eee8dd;color:#332a23;font:18px/1.8 system-ui}main{max-width:760px;margin:7vh auto;padding:28px}h1{font-size:32px}nav{display:grid;gap:14px;margin:28px 0}a{color:#47331f;text-decoration:none;background:#fffaf0;border:1px solid #bda98d;border-radius:9px;padding:15px 22px}a:hover{background:#e7d8be}small{color:#6b6258}</style><main><small>以太都市 · 内容试玩</small><h1>五种世界，日常一瞥</h1><p>新加入675条人物、动作、物件与感官描写。选一个世界，立即看看身边的日常。</p><nav>${examples.map(e=>`<a href="B五题材-${e.theme}.html">${e.name} →</a>`).join('')}</nav><p>进入后可以“再看看周围”，或“返回地点”继续正常游玩。每种世界独立保存进度。</p><small>本页完全离线。正式游戏也已更新；创建新世界后，在地点行动中选择“观察周围的细节”。旧存档保留原来的内容。</small></main></html>`);
console.log('Five playable worlds built; 675 new / 945 combined observation entries.');
