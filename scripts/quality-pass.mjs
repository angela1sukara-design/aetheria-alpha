import{readFile,writeFile}from'node:fs/promises';
async function edit(file,fn){const s=await readFile(file,'utf8');await writeFile(file,fn(s));}
await edit('tests/alpha02-browser.mjs',s=>s.replace("await da('travel.workshop.out');await da('riker.body.gel');","await da('travel.workshop.out');for(let wait=0;await page.locator('[data-action=\"district:action.riker.daily\"]').count()===0;wait++){assert.ok(wait<48);await da('rest.location.workshop');}await da('riker.body.gel');"));
await edit('src/persistence/codec.ts',s=>s.replace('旧版存档已追加街区模块','旧版存档已升级：追加街区模块'));
await edit('index.html',s=>s.replace('深渊重塑 · Alpha 0.1</title>','深渊重塑 · Alpha 0.2</title>'));
await edit('scripts/create-district-c.mjs',s=>s.replace("contentTier:'adult_optional',fallbackTextKey", "contentTier:key==='velvet'?'mature_fade':'adult_optional',fallbackTextKey"));
const p=JSON.parse(await readFile('content/district/pack.json','utf8'));
for(const key of ['gel','wolf'])for(const op of ['pause','resume','cancel']){
 const aid=`district:action.tf.${key}.${op}`;if(p.actions.some(a=>a.id===aid))continue;
 const labels={pause:'暂停',resume:'恢复',cancel:'停止后续'};
 const textKey=`district:text.tf.${key}.${op}`;
 p.texts[textKey]=op==='cancel'?'你按护理说明停止后续变化。已经发生的结构保留，可通过正式恢复入口处理；停止不假装自动逆转已发生的事实。':'你按护理说明调整变化进程，已经经过的阶段不会重复发生。';
 p.actions.push({id:aid,label:labels[op]+(key==='gel'?'黑胶适应':'兽耳适应'),hint:'保留真实阶段与来源',group:'daily',conditions:[],effects:[{op:'tf.'+op,id:'district:tf.'+key}],resultText:textKey,surface:'body'});
 let c=p.contributions.find(c=>c.hookId==='aetheria-tf:hook.body');if(!c)p.contributions.push(c={hookId:'aetheria-tf:hook.body',actionIds:[]});c.actionIds.push(aid);
}
await writeFile('content/district/pack.json',JSON.stringify(p,null,2));
await edit('.gitignore',s=>s+'\n.npm-cache/\ndeliverables/\n');
