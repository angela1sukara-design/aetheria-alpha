import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {deflateRawSync,inflateRawSync} from 'node:zlib';
import {tasks,writing,themes,common} from '../production/collaboration-pack/remaining-work.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const hash=b=>createHash('sha256').update(b).digest('hex');
const json=x=>JSON.stringify(x,null,2)+'\n';
function run(program,args){const r=spawnSync(program,args,{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024});if(r.status!==0)throw Error(program+' '+args.join(' ')+'\n'+r.stdout+'\n'+r.stderr);return r.stdout.trim();}
const commit=run('git',['rev-parse','HEAD']);
const stamp=process.argv[2]??new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+Z$/,'Z');
if(!/^\d{8}T\d{6}Z$/.test(stamp))throw Error('Invalid output stamp');
const out='deliverables/缺口协作包-'+stamp;
const files=new Map();
async function put(file,bytes){const b=Buffer.from(bytes);await mkdir(path.dirname(path.join(root,out,file)),{recursive:true});await writeFile(path.join(root,out,file),b);files.set(file,b);}
const baseline={format:'aetheria-remaining-work-handoff',version:1,sourceCommit:commit,createdAt:new Date().toISOString(),source:'git archive HEAD；仅已提交源码快照，不含本工作区其他未提交变更',gameplayChanged:false,completed:{templates:54,observations:945,settings:17,themeExpansion:12},generatorSources:['scripts/build-remaining-work-pack.mjs','production/collaboration-pack/remaining-work.mjs']};
await put('BASELINE.json',json(baseline));
await put('00-先读我.md',`# 游戏缺口协作包\n\n基准提交：${commit}\n\nA观察模板54条、B素材945条及首批服务、性格交谈已接入。此包针对剩余内容，未安装新玩法。\n\n## 怎么发\n\n- 写代码的AI：发送对应“单独发包/ENG-*.zip”，内含任务及已提交源码快照。\n- 写故事/职业稿的AI：发送对应“单独发包/CONTENT-*.zip”，内含任务和作者中间格式。\n- 写题材素材的AI：每人只发送一个“单独发包/B1-题材.zip”或“B2-题材.zip”；任务书已内嵌所需规范，另有离线校验工具。\n- 不需要把整个总包发给每个AI，也不要让它们通读全部源码。无需给AI账户、网络凭据或其他聊天记录。\n\n## 分工和合并\n\n01：正文工程N，真实交谈/工作/普通战后/身体变化结果；不是重做观察入口。\n02：工程A，幻想三地区与特殊地点；先合入区域结构，再发地点选人选敌扩展。\n03：工程E关系状态与三条完整故事，作者稿CONTENT-NPC可先并行。\n04：工程C真实接取/执行/提交委托，作者稿CONTENT-JOBS可先并行。\n05：剩余12题材，每题材B1道具25+感官15、B2人物20+动作25，共24份/1020条目标。\n\n共有4份工程任务、2份写作任务、24份题材任务（30份单独包）。区域属性驱动选敌属于依赖区域的新一轮任务，已列为后续，不把它说成这次全部完成。\n\n多个工程任务会改同一引擎、类型、生成器和存档文件，不能直接整文件覆盖。先让AI交接口表与补丁，收回后由主项目逐项审查合并；内容作者可全部并行。优先正文接入，再合地区，职业与关系按接口依赖整合。\n\n## 当前资料的优先级\n\n本任务→源码/测试与AGENTS.md→现行安装说明；旧development-plan里的“尚未接入”、旧任务目录、functional默认开放等历史表述不作当前事实。源码.zip为完整已提交工程，仅给有执行环境的代码AI；不用全量粘贴。所有测试必须由接手方实际执行并报告，打包验收不代表玩法完成。\n\n## 收回交付\n\n代码：基准commit、unified diff、新增文件、接口变化和真实测试结果。\n故事/职业：JSON+同名说明，标作者中间稿，未知机制列需求。\nB1/B2：严格v1.3作者JSON+说明，保留draft/hold、事实需求和手工预览；不得自批准。\n\n素材中的Tag用于分类，不证明现场事实。现有B2多数细动作仍需查询适配，写稿不等于自动进游戏。\n\n所有文件校验见PACKAGE-MANIFEST.json；ZIP逐条解压核对后生成验收记录。生成物不进入游戏构建，任务制作源保留在production/collaboration-pack/remaining-work.mjs，可用node scripts/build-remaining-work-pack.mjs重建。\n`);

// Immutable committed snapshot, excluding other tasks' uncommitted edits.
await mkdir(path.join(root,out,'工程附件'),{recursive:true});
const sourceRelative=out+'/工程附件/源码-'+commit.slice(0,8)+'.zip';
run('git',['archive','--format=zip','--output='+sourceRelative,commit]);
const source=await readFile(path.join(root,sourceRelative));files.set('工程附件/源码-'+commit.slice(0,8)+'.zip',source);

// Standard ZIP writer with UTF-8 filenames, followed by independent byte replay.
const table=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc(b){let n=0xffffffff;for(const x of b)n=table[(n^x)&255]^(n>>>8);return(n^0xffffffff)>>>0;}
function zip(entries){const chunks=[],central=[],checks=[];let offset=0;for(const [file,b]of entries){const name=Buffer.from(file),compressed=deflateRawSync(b),h=Buffer.alloc(30),c=Buffer.alloc(46);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(0x800,6);h.writeUInt16LE(8,8);h.writeUInt16LE(0x5d50,12);h.writeUInt32LE(crc(b),14);h.writeUInt32LE(compressed.length,18);h.writeUInt32LE(b.length,22);h.writeUInt16LE(name.length,26);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);h.copy(c,6,4,30);c.writeUInt32LE(offset,42);chunks.push(h,name,compressed);central.push(c,name);checks.push({start:offset+30+name.length,size:compressed.length,sha:hash(b)});offset+=30+name.length+compressed.length;}
 const cd=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);const bytes=Buffer.concat([...chunks,cd,end]);for(const c of checks)if(hash(inflateRawSync(bytes.subarray(c.start,c.start+c.size)))!==c.sha)throw Error('ZIP replay mismatch');return bytes;}

for(const t of tasks){
 for(const f of t.files)await readFile(path.join(root,f));
 const text=`# ${t.id}：${t.title}\n\n模块：${t.module}\n基准commit：${commit}\n\n${common}\n\n## 本任务\n\n${t.needs}\n\n## 必读范围\n\n${t.files.map(f=>'- '+f).join('\n')}\n\n允许顺着这些文件读取直接依赖，不通读整个工程。改UI时按AGENTS.md的新拆分路径定位。\n\n## 自测\n\n${t.tests.map(s=>'- '+s).join('\n')}\n\n另加针对新增行为的必要测试，不能仅复述实现。未执行浏览器流程必须声明。\n\n## 协作依赖\n\n${t.dependencies}\n`;
 await put(t.folder+'/'+t.id+'.md',text);
 const entries=[['任务.md',Buffer.from(text)],['BASELINE.json',Buffer.from(json(baseline))],['源码.zip',source]];
 await put('单独发包/'+t.id+'.zip',zip(entries));
}
for(const t of writing){
 const text=`# ${t.id}：${t.title}\n\n基准commit：${commit}\n\n这是作者中间稿任务，不是游戏ContentPack。稿件将由工程AI映射真实条件/效果再接入。提交完整JSON与同名MD，声明数量、依赖、未知事实和未执行验证。\n\n${t.body}\n\n## 格式骨架\n\n下面仅是结构示意，不算数量。ID在本批唯一；不增加未约定顶层字段，玩法建议放proposedConsequences/neededMechanics等现有位置。允许必要的内容条目数扩充。所有阶段、next和结局引用必须存在；不把示例的一阶段直接当成完整稿。\n\n~~~json\n${json(t.shape)}~~~\n\n## 共同约束\n\n人名/地名使用【人物】/【地点】显示占位，须列明绑定用途，整合时替换为实际显示引用；不是可直接送入运行时的模板语法。未知现场事实列requiredFacts，不能靠职业、Tag或文案证明。每阶段免费退出不扣资源、不更改关系。所有结果正文是候选，不自动执行。禁止未发生行为、重复发奖、把拒绝写成接受。\n\n## 验收\n\n角色/阶段/选择/结局数量达标；引用无悬空；有明确阶段条件和分歧；无固定运行ID；所有新增机制显式提案；附每条至少一条完整走读路径及一个拒绝/暂缓路径。没有游戏环境只报告人工走读，不声称已经运行。\n`;
 await put(t.folder+'/'+t.id+'.md',text);await put(t.folder+'/'+t.id+'-格式示意.json',json(t.shape));
 await put('单独发包/'+t.id+'.zip',zip([['任务.md',Buffer.from(text)],['格式示意.json',Buffer.from(json(t.shape))],['BASELINE.json',Buffer.from(json(baseline))]]));
}

// Reuse the current authoring validator; never fork its schema or assembler.
run(process.execPath,['scripts/build-collaboration-pack.mjs']);
const standard=path.join(root,'deliverables/协作包-通用版-v1.3');
const shared=[];
async function collect(dir,prefix=''){for(const e of await readdir(dir,{withFileTypes:true})){const f=prefix+e.name;if(e.isDirectory())await collect(path.join(dir,e.name),f+'/');else shared.push([f,await readFile(path.join(dir,e.name))]);}}
await collect(path.join(standard,'tools'),'tools/');await collect(path.join(standard,'schemas'),'schemas/');
// check.mjs audits the entire original authoring distribution, not this small packet.
shared.splice(shared.findIndex(([file])=>file==='tools/check.mjs'),1);
for(const f of ['02-词池总表.json','08-全量注册Tag快照.json','09-事实目录.json','assembly-rules.json','03-示例与手工拼装方法.json'])shared.push([f,await readFile(path.join(standard,f))]);
for(const [id,name]of themes)for(const kind of ['B1','B2']){
 const standardFile=(await readdir(path.join(standard,'独立发卡'))).find(f=>f.startsWith(kind+'-')&&f.endsWith('.md'));
 if(!standardFile)throw Error('Missing task '+kind);
 const inherited=await readFile(path.join(standard,'独立发卡',standardFile),'utf8');
 const header=`# 本批唯一任务：${kind}-${id}（${name}）\n\n此页优先于后附旧配额与阶段口径。只做这一题材/这一任务；已经完成的五题材modern/cyberpunk/fantasy/xianxia/post-apocalypse不重写。\n\n基准commit：${commit}\n交付文件名：${kind}-${id}-delivery.json 与同名.md。format=aetheria-authoring-delivery，specVersion=1.3，task=${kind}，theme=${id}，batchId全局唯一，revision从1起。每批至少3条manual/hypothetical-only手工预览。\n\n${kind==='B1'?'数量：environment.prop 25条 + 感官15条，共40条；感官15是所有子池合计，至少覆盖四种通道。':'数量：actor.form 20条 + action.observed 25条，共45条；人物泛称与已观察动作分开。'}\n\n每条requires带scene.setting eq ${id}，确保题材边界；其它事实需要查询条件。词条不写死人名/地点/实例ID。原稿只用draft/hold；细动作、衣着、位置、容器内物、材质等未知现场事实要hold并填pendingFacts，不能将Tag代替事实。不得自称游戏批准或自动可见。正文general，不扩写成人情节。\n\n本批来源是作者候选；当前游戏已有A54与B945，以及三个观察入口。后附目录中fixture-only事实仍是作者测试合同；生产实际支持以当前适配器为准。不要因旧规范写“尚未接入”而重做引擎或A模板。\n\n解压后可运行 node tools/validate-delivery.mjs 文件.json；附工具只校验作者格式，不保证现场语义或实装。说明填写词条数量、draft/hold分账、每种未知事实、题材辨识与预览所用ID。不得为凑配额重复同义词。\n\n---\n\n`;
 const text=header+inherited;await put('05-十二题材素材/'+kind+'-'+id+'.md',text);
 await put('单独发包/'+kind+'-'+id+'.zip',zip([['任务.md',Buffer.from(text)],['BASELINE.json',Buffer.from(json(baseline))],...shared]));
}
const expected=4+2+themes.length*2;
if([...files.keys()].filter(f=>f.startsWith('单独发包/')).length!==expected)throw Error('Task count mismatch');
const manifest={...baseline,taskCount:expected,targets:{B1:themes.length*40,B2:themes.length*45,totalWords:themes.length*85},sourceArchiveSha256:hash(source),generatorSha256:Object.fromEntries(await Promise.all(baseline.generatorSources.map(async f=>[f,hash(await readFile(path.join(root,f)))]))),files:[...files].map(([file,b])=>({file,bytes:b.length,sha256:hash(b)})),validation:{allTaskInputPathsExist:true,allGeneratedZipEntriesReadBack:true,standardAuthoringChecks:'scripts/build-collaboration-pack.mjs执行成功；详见其输出报告',gameplayTestsRun:false}};
await put('PACKAGE-MANIFEST.json',json(manifest));
const archive=out+'.zip';const bundle=zip([...files]);await writeFile(path.join(root,archive),bundle);
await mkdir(path.join(root,'artifacts/remaining-work-package'),{recursive:true});
await writeFile(path.join(root,'artifacts/remaining-work-package/latest.json'),json({status:'passed',archive,folder:out,sourceCommit:commit,bytes:bundle.length,sha256:hash(bundle),tasks:expected,files:files.size,allArchiveEntriesReadBack:true,gameplayChanged:false}));
console.log(json({archive,folder:out,sourceCommit:commit,tasks:expected,bytes:bundle.length,sha256:hash(bundle)}));
