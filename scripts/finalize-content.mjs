import{readFile,writeFile}from'node:fs/promises';
async function edit(f,fn){await writeFile(f,fn(await readFile(f,'utf8')));}
await edit('src/content/schema.ts',s=>s.replace("['id', 'npcId', 'textKey']); id(x.id", "['id', 'npcId', 'textKey', 'relationshipStage']); if(x.relationshipStage!==undefined)choice(x.relationshipStage,p,['introduced','familiar','trusted','private','closed']); id(x.id"));
await edit('src/content/district-schema.ts',s=>s.replace("['id','locationId','conditions','priority','textKey']); for", "['id','locationId','conditions','priority','textKey','owner']); if(x.owner){const owner=obj(x.owner,p,['eventId','nodeId']);id(owner.eventId,p);str(owner.nodeId,p);} for"));
await edit('tests/district-d.test.ts',s=>s.replace("da(e,'observe.location.market');da(e2,'observe.location.market');", "assert.ok(e.performAction({actionId:'district:action.observe.location.market'},0,'same-draw').ok);assert.ok(e2.performAction({actionId:'district:action.observe.location.market'},0,'same-draw').ok);"));
const ext=JSON.parse(await readFile('content/extension-event/pack.json','utf8'));if(!ext.manifest.dependencies.some(d=>d.id==='engine/core'))ext.manifest.dependencies.push({id:'engine/core',version:'0.1.0',optional:false});await writeFile('content/extension-event/pack.json',JSON.stringify(ext,null,2));
const p=JSON.parse(await readFile('content/district/pack.json','utf8'));
for(const m of p.npcMemories){const key=m.id.split(':memory.')[1];if(key.endsWith('.introduced'))m.relationshipStage='introduced';if(key.endsWith('.promise'))m.relationshipStage='familiar';if(/\.(repaired|shared|private|personal)$/.test(key))m.relationshipStage='trusted';if(/\.(invited|quiet)$/.test(key))m.relationshipStage='private';if(key.endsWith('.breach'))m.relationshipStage='closed';}
const flag=key=>({op:'flag.has',id:'district:flag.'+key,value:true}),mem=(key)=>({op:'npc.memory',npcId:'district:npc.'+key.split('.')[0],memoryId:'district:memory.'+key,value:true});
const variants=[
 ['riker.repaired','district:location.workshop','district:event.riker.daily',[mem('riker.repaired')],'莱克指了指已经归还原主的义肢留下的空位。“上次那只手回家了。你带回授权和接口的事，我没有忘。”他问你，今天有没有需要按自己方式安排的事。'],
 ['riker.closed','district:location.workshop','district:event.riker.daily',[mem('riker.breach')],'莱克把话题留在公开工作上。“修理可以继续，私人安排就到这里。”他记得那笔补贴，也把双方仍可遵守的职业边界说清楚。'],
 ['riker.private','district:location.cafe','district:event.riker.daily',[flag('riker.willing')],'莱克在茶馆认出你，给桌边留出空间。“今天不用谈工单。上次那封回信，我又读了一遍。”他没有把邀请当作你必须接受的义务。'],
 ['nara.follow','aetheria-tf:location.clinic','district:event.nara.daily',[flag('nara.done')],'娜拉说起你们整理的护理卡。“你允许公开的部分仍保持匿名。有人按里面的方法调整了椅子，终于能自己休息好。”她记得你对公开范围的选择。']
];for(const [key,locationId,eventId,conditions,tx]of variants){const id='district:scene.follow.'+key,textKey='district:text.follow.'+key;p.texts[textKey]=tx;if(!p.sceneTexts.some(v=>v.id===id))p.sceneTexts.push({id,locationId,owner:{eventId,nodeId:'start'},conditions,priority:30,textKey});}
for(const [key,locationId,tx]of [['rain','aetheria:location.street','你曾经拦起围栏的路口已经补好绝缘层。维修队留下了一张公开验收单，那次协助并没有随着页面关闭而消失。'],['water','district:location.canal','新的警戒刻度对应你协助记录过的水位。低处行人开始沿更安全的路线通过。'],['ledger','district:location.archive','补齐的工时残页已经装订归档。公开索引注明了核对来源，工人的工时不再只靠口头争辩。']]){const id='district:scene.story.after.'+key,textKey='district:text.story.after.'+key;p.texts[textKey]=tx;if(!p.sceneTexts.some(v=>v.id===id))p.sceneTexts.push({id,locationId,conditions:[flag('story.'+key)],priority:15,textKey});}
const curtain=p.storylets.find(s=>s.id==='district:storylet.curtain');if(!curtain.conditions.some(c=>c.op==='npc.present'))curtain.conditions.push({op:'npc.present',npcId:'aetheria-social:npc.velvet'});
for(const st of p.storylets)if(st.hidden)st.weight=5;
await writeFile('content/district/pack.json',JSON.stringify(p,null,2));
