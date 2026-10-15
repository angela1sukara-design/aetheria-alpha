import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {stripTypeScriptTypes} from 'node:module';
import {spawnSync} from 'node:child_process';
import {deflateRawSync,inflateRawSync} from 'node:zlib';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {version,slots,themes,pools,bindingRoles,facts,quotas} from '../production/collaboration-pack/catalog.mjs';
import {schemas} from '../production/collaboration-pack/schema.mjs';
import {createExample} from '../production/collaboration-pack/fixture.mjs';
import {taskCards} from '../production/collaboration-pack/tasks.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),source='production/collaboration-pack',out='deliverables/协作包-通用版-v1.3',archive='deliverables/协作包-通用版-v1.3-已修订.zip';
const sha=b=>createHash('sha256').update(b).digest('hex'),json=x=>JSON.stringify(x,null,2)+'\n';
await mkdir(path.join(root,out),{recursive:true});const generated=new Set();
async function put(file,bytes){const p=path.join(root,out,file);await mkdir(path.dirname(p),{recursive:true});await writeFile(p,bytes);generated.add(file);}
async function walk(dir){const result=[];for(const e of await readdir(path.join(root,dir),{withFileTypes:true})){const f=dir+'/'+e.name;if(e.isDirectory())result.push(...await walk(f));else result.push(f);}return result.sort();}
const commit=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).stdout?.trim()??'unknown';
const defaults=new Set((JSON.parse(await readFile(path.join(root,'content/index.json'),'utf8'))).packs.map(p=>'content/'+p.replace(/^\.\//,'')));
const packs=[],tagMap=new Map();
for(const file of (await walk('content')).filter(p=>p.endsWith('.json'))){const bytes=await readFile(path.join(root,file)),d=JSON.parse(bytes);if(!d.manifest?.id||!Array.isArray(d.tags))continue;packs.push({id:d.manifest.id,version:d.manifest.version,dependencies:d.manifest.dependencies??[],source:file,sha256:sha(bytes),defaultLoaded:defaults.has(file)});for(const [i,t]of d.tags.entries()){if(tagMap.has(t.id))throw Error('重复注册ID：'+t.id);tagMap.set(t.id,{canonicalId:t.id,label:t.label,definition:t.definition,status:t.status,aliases:t.aliases??[],replacementId:t.replacementId??null,ownerPackId:d.manifest.id,source:file,pointer:'/tags/'+i,usage:t.id.startsWith('general-taxonomy:')?'editorial-retrieval; 不证明实体状态':t.id.startsWith('personality:trait.')?'structured-personality-input; 仍需绑定真实居民':t.id.startsWith('worlds:setting.')?'world-profile-selection; 现场题材读保存快照':'registered-definition; 事实资格须由相应查询/状态证明',definitionRecord:t});}}
const tags={format:'aetheria-registered-tag-snapshot',specVersion:version,date:'2026-10-15',sourceCommit:commit,coverage:'content下全部实际ContentPack的Tag定义，不含未注册词条或提案',tags:[...tagMap.values()].sort((a,b)=>a.canonicalId.localeCompare(b.canonicalId,'en')),packs};
await put('08-全量注册Tag快照.json',json(tags));
const ids=JSON.parse(await readFile(path.join(root,source,'tag-reference-ids.json'),'utf8'));const groups={};for(const [pool,values]of Object.entries(ids.pools)){groups[pool]={};for(const id of values){const t=tagMap.get(id);if(!t||t.status!=='active')throw Error('参考Tag缺失或停用：'+id);groups[pool][id]=t.label;}}
await put('05-Tag参考.json',json({title:'词池Tag参考子集',specVersion:version,sourceCommit:commit,usage:'登记/检索分类，不证明场景事实；全库查重使用08。material.all是参考分组，不是可入槽池。environment.sense子池共用environment.sense参考分组。',themes:ids.themes,pools:groups}));
const poolData={specVersion:version,slots,themes:{list:themes,mvpOrder:quotas.mvpThemes},bindingRoles,pools,quotas,selection:{strategy:'priority-desc-then-seeded-hash-then-id',samePriorityAllowed:true,weightFieldSupported:false,maxCandidatesPerSlot:4,maxSteps:64,templateSelectionImplemented:false,source:'tools/runtime/assembly.mjs'}};
await put('02-词池总表.json',json(poolData));await put('09-事实目录.json',json({specVersion:version,scope:'已冻结的中性fixture查询合同；真实游戏适配器未接入。未知查询走hold，不能由文本生成事实。',facts}));
for(const name of await readdir(path.join(root,source,'docs')))await put(name,await readFile(path.join(root,source,'docs',name)));
for(const name of await readdir(path.join(root,source,'tools'))){let bytes=await readFile(path.join(root,source,'tools',name));if(name==='authoring.mjs')bytes=Buffer.from(bytes.toString('utf8').replace("'../../tag-matrices/assembly.mjs'","'./runtime/assembly.mjs'").replace("'../../../src/content/player-prose.ts'","'./runtime/player-prose.mjs'"));await put('tools/'+name,bytes);}
const schemaData=schemas();for(const [name,data]of Object.entries(schemaData))await put('schemas/'+name,json(data));
const kernelSources={};for(const file of ['production/tag-matrices/assembly.mjs','production/tag-matrices/spec.mjs','src/content/player-prose.ts'])kernelSources[file]=sha(await readFile(path.join(root,file)));
await put('tools/runtime/assembly.mjs',(await readFile(path.join(root,'production/tag-matrices/assembly.mjs'),'utf8')).replace("'../../src/content/player-prose.ts'","'./player-prose.mjs'"));
await put('tools/runtime/spec.mjs',await readFile(path.join(root,'production/tag-matrices/spec.mjs')));await put('tools/runtime/player-prose.mjs',stripTypeScriptTypes(await readFile(path.join(root,'src/content/player-prose.ts'),'utf8')));
await put('tools/runtime/SOURCE.json',json({sourceCommit:commit,originalSourceSha256:kernelSources,changes:'assembly只改普通文字校验器的相对import；player-prose只移除TypeScript类型；spec原字节复制。不是完整游戏源码。'}));
const original=JSON.parse(await readFile(path.join(root,'production/tag-matrices/assembly-example.json'),'utf8')),baseCatalog=JSON.parse(await readFile(path.join(root,'production/tag-matrices/assembly-rules.json'),'utf8'));
const example=createExample(original);const emptyBase={...baseCatalog,rules:[]};await put('assembly-rules.json',json(emptyBase));
const tool=await import(pathToFileURL(path.join(root,out,'tools/authoring.mjs')).href);const runtime=await import(pathToFileURL(path.join(root,out,'tools/runtime/assembly.mjs')).href);
const bundle={schemas:{word:schemaData['word.schema.json'],template:schemaData['template.schema.json'],delivery:schemaData['delivery.schema.json'],proposal:schemaData['proposal.schema.json']},pools:poolData,facts:{facts},tags,baseCatalog:emptyBase};
const compiled=tool.convertFixture(example.deliveries,example.plan,example.context,bundle);
const rendered=compiled.catalog.rules.map(r=>({ruleId:r.id,...runtime.assembleProse({catalog:compiled.catalog,assemblyRuleId:r.id,lexemes:compiled.lexemes,context:example.context})}));if(rendered.some(r=>r.mode!=='assembled'))throw Error('中性闭环拼装失败：'+json(rendered));
for(const d of example.deliveries){
 const targets=d.task.startsWith('A')?d.entries.map(e=>e.id):[d.task==='B3'?'assembly.08.demo.body':'assembly.05.demo.observation'];
 d.handPreviews=targets.flatMap(ruleId=>Array.from({length:targets.length===1?3:2},(_,i)=>{const context={...example.context,seed:example.context.seed+i},r=runtime.assembleProse({catalog:compiled.catalog,assemblyRuleId:ruleId,lexemes:compiled.lexemes,context});if(r.mode!=='assembled')throw Error('示例预览不可复现');return {templateId:ruleId,entryIds:r.selected.map(s=>s.entryId),fixtureId:context.fixtureId,seed:context.seed,revision:context.revision,mode:'reference-assembler',text:r.text,evidenceStatus:'fixture-verified'};}));
}
// 预览不改变词条摘要；原稿始终保留draft/hold。
await put('03-示例与手工拼装方法.json',json(example));await put('assembly-rules.json',json(compiled.catalog));
await put('10-中性闭环样例.json',json({specVersion:version,fixtureOnly:true,runtimeIntegrated:false,warning:'人工构造快照和独立测试审稿计划，不是真实游戏导出；所有来源均明确synthetic。',context:example.context,integrationPlan:example.plan,converted:{lexemes:compiled.lexemes,held:compiled.held,assemblyRulesFile:'assembly-rules.json'},results:rendered}));
await put('README.md',`# 协作包通用版 v${version}\n\n先读00；给其他AI优先发送独立发卡中对应完整MD。原包未覆盖。\n\n离线检查：Node24，运行 node tools/check.mjs；外部稿：node tools/validate-delivery.mjs 文件.json。无需第三方依赖或工程访问。\n\n真实游戏ENG接入、查询/Tag资格、模板轮换、持久审批与游戏存档集成均未因本包而实现。示例只验普通中性fixture；正式810词条、54–72模板尚需制作。\n`);
await put('附录-姓名与继承.md',`# 姓名消费与继承边界 v1.3\n\n源工程0.11.0已保存personalName的姓、名、文化顺序及显示全名；旧档和固定人物不重抽或猜拆姓名。文案作者只读actor.name，不拼接自己的姓氏词，不将同名当同一人物。\n\n子代命名已有独立接口，支持指定亲代姓、家庭共姓和双姓；出生实体/家庭生命周期尚未实装。正文不得凭名字创建后代、认亲、改姓或改人物ID。绑定名字的唯一来源是同revision精确主体/实例的displayValues快照，本包演示名仅用于人工中性测试。\n`);
const cards=taskCards();for(const c of cards)await put('任务卡/'+c.file,c.text);
const embedded=[];
for(const c of cards){
 let text=c.text+'\n\n# 本任务全部输入正文\n\n';
 const schemaNames=c.id==='T1'?['proposal','tagBatch']:c.id==='D1'?Object.keys(schemaData).map(n=>n.replace('.schema.json','')):c.id==='P0'?['word','template','delivery','proposal']:c.id.startsWith('A')?['template','delivery']:['word','delivery','proposal'];
 const inputs=[...c.needs,...schemaNames.map(n=>'schemas/'+n+'.schema.json'),...(c.id==='D1'?[...generated].filter(f=>f.startsWith('tools/')):[])];
 for(const file of [...new Set(inputs)]){const bytes=await readFile(path.join(root,out,file));const content=bytes.toString('utf8');text+='\n## 完整输入文件：'+file+'\n\n'+(/\.(json|mjs)$/.test(file)?'~~~'+(file.endsWith('.json')?'json':'javascript')+'\n'+content+'\n~~~\n':content)+'\n';embedded.push({taskId:c.id,taskFile:'独立发卡/'+c.file,inputFile:file,bytes:bytes.length,sha256:sha(bytes)});}
 await put('独立发卡/'+c.file,text);
}
await put('独立发卡/输入全文核对.json',json({specVersion:version,entries:embedded}));
async function manifest(){const list=[];for(const file of [...generated].filter(f=>f!=='PACKAGE-MANIFEST.json').sort()){const bytes=await readFile(path.join(root,out,file));list.push({path:file,bytes:bytes.length,sha256:sha(bytes)});}await put('PACKAGE-MANIFEST.json',json({format:'aetheria-authoring-package',specVersion:version,sourceCommit:commit,runtimeIntegrated:false,tagCount:tags.tags.length,files:list}));}
await manifest();const run=spawnSync(process.execPath,[path.join(root,out,'tools/check.mjs')],{cwd:path.join(root,out),encoding:'utf8',windowsHide:true,maxBuffer:4*1024*1024});await mkdir(path.join(root,'artifacts/collaboration-pack-v1.3'),{recursive:true});await writeFile(path.join(root,'artifacts/collaboration-pack-v1.3/tests.log'),run.stdout+'\n'+run.stderr);if(run.status!==0){console.error(run.stdout,run.stderr);throw Error('协作包验收失败');}
generated.add('11-覆盖与验收报告.json');await manifest();
// 标准UTF-8 ZIP；只压显式生成清单，不携带旧目录残留或工程依赖。
const table=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});const crc32=b=>{let n=0xffffffff;for(const x of b)n=table[(n^x)&255]^(n>>>8);return(n^0xffffffff)>>>0;};
const locals=[],central=[],checks=[];let offset=0;for(const file of [...generated].sort()){const name=Buffer.from('协作包-通用版/'+file),bytes=await readFile(path.join(root,out,file)),compressed=deflateRawSync(bytes),crc=crc32(bytes),header=Buffer.alloc(30),record=Buffer.alloc(46);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(8,8);header.writeUInt16LE(0x5d4f,12);header.writeUInt32LE(crc,14);header.writeUInt32LE(compressed.length,18);header.writeUInt32LE(bytes.length,22);header.writeUInt16LE(name.length,26);record.writeUInt32LE(0x02014b50);record.writeUInt16LE(20,4);header.copy(record,6,4,30);record.writeUInt32LE(offset,42);checks.push({path:file,start:offset+30+name.length,size:compressed.length,sha256:sha(bytes),crc});locals.push(header,name,compressed);central.push(record,name);offset+=30+name.length+compressed.length;}
const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(generated.size,8);end.writeUInt16LE(generated.size,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);const zip=Buffer.concat([...locals,directory,end]);await writeFile(path.join(root,archive),zip);for(const c of checks){const bytes=inflateRawSync(zip.subarray(c.start,c.start+c.size));if(sha(bytes)!==c.sha256||crc32(bytes)!==c.crc)throw Error('ZIP读回不符：'+c.path);}
const report=JSON.parse(await readFile(path.join(root,out,'11-覆盖与验收报告.json'),'utf8'));await writeFile(path.join(root,'artifacts/collaboration-pack-v1.3/package-verification.json'),json({status:'passed',archive,sha256:sha(zip),bytes:zip.length,files:generated.size,tags:tags.tags.length,tests:report.tests,sourceCommit:commit,allArchiveEntriesReadBack:true,originalArchiveOverwritten:false,runtimeIntegrated:false}));console.log(json({archive,MiB:(zip.length/1024**2).toFixed(2),files:generated.size,tags:tags.tags.length,tests:report.tests,previews:report.example}));
