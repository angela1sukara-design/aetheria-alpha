import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {generatePersonalName,formatName,createChildName,validateNameCulture,validatePersonalName} from '../src/world/names.ts';
import type {NameCulture,PersonalName} from '../src/core/name-types.ts';
import {packs} from './helpers.ts';
import {loadPacks} from '../src/content/loader.ts';
import {WorldGenerator} from '../src/world/generator.ts';
import {validateState,SaveCodec} from '../src/persistence/codec.ts';

const chinese:NameCulture={id:'test-chinese',familyNames:['林','沈','慕容'],order:'family-given',separator:'',defaultInheritance:'parentA'};
const western:NameCulture={id:'test-western',familyNames:['Vale','Reed','Stone'],order:'given-family',separator:'·',defaultInheritance:'parentB'};
const single:NameCulture={id:'test-single',familyNames:[],order:'single',separator:'',defaultInheritance:'none'};
const givenNames=['清岚','星河','知远'];
const named=(givenName:string,familyNames:string[],c=chinese):PersonalName=>({cultureId:c.id,givenName,familyNames,order:c.order,separator:c.separator});
const parents=[{id:'resident:parent-a',personalName:named('清岚',['林'])},{id:'resident:parent-b',personalName:named('星河',['沈'])}];
const child=(extra={})=>createChildName({seed:42,childId:'resident:child-1',culture:chinese,givenNames,parents,...extra});

test('名与姓独立生成，中文、西式、单名格式以及复姓不猜测截字',()=>{
 assert.equal(formatName(named('清岚',['慕容'])),'慕容清岚');assert.equal(formatName(named('Elena',['Vale'],western)),'Elena·Vale');
 for(const culture of [chinese,western,single]){const n=generatePersonalName({seed:42,entityId:'npc:one',givenNames,culture});validatePersonalName(n);assert.ok(givenNames.includes(n.givenName));assert.equal(n.familyNames.length,culture.order==='single'?0:1);}
});
test('姓名只由创建输入决定且不修改输入，40人尽量不重名、不附加编号',()=>{
 const options={seed:42,entityId:'resident:worldgen:location.0:worldgen:resident.0',givenNames,culture:chinese};const before=structuredClone(options);
 assert.deepEqual(generatePersonalName(options),generatePersonalName(options));assert.deepEqual(options,before);
 const used:string[]=[];for(let i=0;i<40;i++){const n=generatePersonalName({...options,entityId:'npc:'+i,usedNames:used});used.push(formatName(n));}assert.equal(new Set(used.slice(0,9)).size,9);assert.ok(used.every(n=>!/[0-9]/.test(n)));assert.ok(new Set(Array.from({length:20},(_,seed)=>formatName(generatePersonalName({...options,seed})))).size>1);
});
test('子代默认继承明确亲代，名由子代自己的种子和身份抽取',()=>{
 const a=child(),b=child();assert.deepEqual(a,b);assert.deepEqual(a.personalName.familyNames,['林']);assert.deepEqual(a.parentIds,parents.map(p=>p.id));assert.deepEqual(a.surnameRule,{kind:'parent',parentId:parents[0].id});
 const second=child({culture:{...chinese,defaultInheritance:'parentB'}});assert.deepEqual(second.personalName.familyNames,['沈']);
 assert.deepEqual(child({surnameRule:{kind:'parent',parentId:parents[1].id}}).personalName.familyNames,['沈']);
});
test('家庭共姓、收养、跨文化保留姓氏文字，未知亲代不随机编造姓',()=>{
 assert.deepEqual(child({parents:[],surnameRule:{kind:'household',familyNames:['顾']}}).personalName.familyNames,['顾']);
 const cross=child({culture:western,surnameRule:{kind:'parent',parentId:parents[0].id}});assert.equal(cross.name,cross.personalName.givenName+'·林');
 assert.throws(()=>child({parents:[{id:parents[0].id}]}));assert.throws(()=>child({surnameRule:{kind:'parent',parentId:'resident:unrelated'}}));assert.throws(()=>child({parents:[]}));
 assert.deepEqual(child({culture:single,parents:[]}).personalName.familyNames,[]);
});
test('双姓按明确亲代分量组成，同姓去重，多代不无限串接',()=>{
 assert.deepEqual(child({culture:{...chinese,defaultInheritance:'compound'}}).personalName.familyNames,['林','沈']);
 const dual=[{id:'A',personalName:named('甲',['林','沈'])},{id:'B',personalName:named('乙',['顾','叶'])}];
 assert.deepEqual(child({parents:dual,surnameRule:{kind:'compound',sources:[{parentId:'B',familyIndex:1},{parentId:'A',familyIndex:0}]}}).personalName.familyNames,['叶','林']);
 const same=parents.map(p=>({...p,personalName:named('甲',['林'])}));assert.deepEqual(child({parents:same,culture:{...chinese,defaultInheritance:'compound'}}).personalName.familyNames,['林']);
 assert.throws(()=>child({surnameRule:{kind:'compound',sources:[{parentId:parents[0].id,familyIndex:9},{parentId:parents[1].id,familyIndex:0}]}}));
});
test('姓名和继承严格校验，缺姓、乱槽、重复亲代、注入文本和文化矛盾拒绝',()=>{
 for(const v of [{...chinese,order:'random'},{...single,familyNames:['林']},{...chinese,familyNames:[]},{...chinese,extra:true}])assert.throws(()=>validateNameCulture(v));
 for(const v of [named('{name}',['林']),named('<script>',['林']),named('清岚',[]),{...named('清岚',['林']),order:'unknown'},named('清岚',['林','林'])])assert.throws(()=>validatePersonalName(v));
 assert.throws(()=>child({parents:[parents[0],parents[0]]}));assert.throws(()=>child({surnameRule:{kind:'none'}}));assert.throws(()=>child({culture:single,surnameRule:{kind:'household',familyNames:['林']}}));
 const before=structuredClone(parents);child();assert.deepEqual(parents,before);
});

const json=async(name:string)=>JSON.parse(await readFile(new URL('../content/'+name+'.json',import.meta.url),'utf8'));
const content=await json('generation/neighborhood-content');
const registry=await loadPacks([...await packs(),await json('district/pack'),content]);
const rules=await json('generation/rules'),reference=await json('generation/reference');
test('0.11新世界姓名保存于模板与居民，无编号；缺失或篡改结构化姓名拒绝读档',async()=>{
 const g=await new WorldGenerator().generate({seed:42,registry,rules,references:[reference]});validateState(g.state,g.registry);assert.equal(g.world.generation.generatorVersion,'0.11.0');
 for(const r of g.state.district!.residents){assert.ok(r.personalName);assert.equal(formatName(r.personalName),r.name);assert.doesNotMatch(r.name,/·\d+$/);}
 for(const alter of [(s:typeof g.state)=>{delete s.district!.residents[0]!.personalName;},(s:typeof g.state)=>{s.district!.residents[0]!.personalName!.givenName='陌生名';},(s:typeof g.state)=>{s.district!.residents[0]!.personalName=s.district!.residents[1]!.personalName;}]){const s=structuredClone(g.state);alter(s);assert.throws(()=>validateState(s,g.registry));}
 const again=await new WorldGenerator().generate({seed:42,registry,rules,references:[reference]});assert.deepEqual(g.state.district,again.state.district);
 const decoded=await new SaveCodec(registry).decode(await new SaveCodec(g.registry).encode(g.state));assert.equal(decoded.status,'ready');if(decoded.status==='ready')assert.deepEqual(decoded.state.district,g.state.district);
 // 0.10 快照只持有原全名，无结构化字段；加载时不得猜拆/补姓。
 const legacy=structuredClone(g.state);legacy.worldInstance!.generation.generatorVersion='0.10.0';
 for(const pack of legacy.worldInstance!.definition.packs){if(pack.manifest.id==='generated/neighborhood'){pack.manifest.version='0.10.0';for(const t of pack.residentTemplates??[]){delete t.personalName;delete t.nameCulture;}}}
 for(const n of legacy.district!.residents)delete n.personalName;
 const legacyRegistry=await loadPacks(legacy.worldInstance!.definition.packs);legacy.meta.packs=structuredClone(legacyRegistry.packs);
 const old=await new SaveCodec(registry).decode(await new SaveCodec(legacyRegistry).encode(legacy));assert.equal(old.status,'ready');if(old.status==='ready'){assert.deepEqual(old.state.district,legacy.district);assert.ok(old.state.district!.residents.every(n=>n.personalName===undefined));}
});
test('未声明名池的旧模板不猜拆全名，显式名文化进入新居民且Schema拒绝不一致全名',async()=>{
 const updated=structuredClone(content);for(const t of updated.residentTemplates){t.names=['清岚','星河','知远'];t.nameCulture=chinese;}
 const r=await loadPacks([...await packs(),await json('district/pack'),updated]);const g=await new WorldGenerator().generate({seed:7,registry:r,rules,references:[reference]});
 validateState(g.state,g.registry);assert.ok(g.state.district!.residents.every(n=>n.personalName!.cultureId===chinese.id&&n.name.startsWith(n.personalName!.familyNames[0]!)));
 const bad=structuredClone(updated);bad.residentTemplates[0].personalName=named('清岚',['林']);await assert.rejects(async()=>loadPacks([...await packs(),await json('district/pack'),bad]));
});
