import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { catalog, initialPlan } from './catalog.mjs';

const fail = message => { throw Error(message); };
export const digest = value => createHash('sha256').update(stable(value)).digest('hex');
function stable(value) {
 if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
 if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
 return JSON.stringify(value);
}
export function exact(value, required, optional=[]) {
 if (!value || typeof value!=='object' || Array.isArray(value) || required.some(k=>!Object.hasOwn(value,k)) || Object.keys(value).some(k=>![...required,...optional].includes(k))) fail(`字段不符：必须 ${required.join(', ')}；可选 ${optional.join(', ')}。禁止引擎规则字段。`);
}
function string(value,max,label) {
 if (typeof value!=='string' || !value.trim() || value!==value.trim() || [...value].length>max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) fail(`${label} 必须是无首尾空白的非空文本，最多 ${max} 个 Unicode 字符。`);
}
function strings(value,maxItems,maxLength,label) {
 if (!Array.isArray(value) || value.length<1 || value.length>maxItems) fail(`${label} 数组长度必须为 1–${maxItems}。`);
 value.forEach(v=>string(v,maxLength,label));
 if (new Set(value).size!==value.length) fail(`${label} 不得包含重复项。`);
}
export function validateBatch(raw,{allowExample=false,expected}={}) {
 exact(raw,['format','schemaVersion','library','batchId','source','entries']);
 if (raw.format!=='aetheria-lexicon-batch' || raw.schemaVersion!==1) fail('不是基础词条批次 v1；不能导入游戏内容包或参考规则包。');
 const c=catalog.find(c=>c.code===raw.library); if (!c) fail('未知词库分类。');
 const suffix=allowExample?'[be]':'b';
 if (typeof raw.batchId!=='string' || !new RegExp(`^${c.code}\\.${suffix}[0-9]{4}$`).test(raw.batchId) || raw.batchId.endsWith('0000')) fail('批次 ID 不合法；示例不能当作正式交付导入。');
 exact(raw.source,['producer','model','theme']);
 string(raw.source.producer,100,'来源 producer'); string(raw.source.model,100,'来源 model'); string(raw.source.theme,500,'主题 theme');
 if (!Array.isArray(raw.entries) || raw.entries.length<1 || raw.entries.length>50) fail('每个交付批次必须为 1–50 条。');
 if (expected && (raw.batchId!==expected.batchId || raw.library!==expected.library || raw.entries.length!==expected.size || raw.source.theme!==expected.theme)) fail('交付的批次、分类、数量或主题与已领取任务不符。');
 raw.entries.forEach((e,i)=>{
  const content=c.kind==='phrase'?['text','description']:c.kind==='trait'?['name','description','examples']:['name','description'];
  exact(e,['id','category','subcategory',...content],['tags','synonyms']);
  const id=`lx.${raw.batchId}.${String(i+1).padStart(4,'0')}`;
  if (e.id!==id || e.category!==c.code || !c.subcategories.includes(e.subcategory)) fail(`第 ${i+1} 条 ID/分类/子类不符；应为 ${id}，子类从任务清单选择。`);
  string(e.description,240,'description');
  if (c.kind==='phrase') string(e.text,400,'text'); else string(e.name,40,'name');
  if (c.kind==='trait') strings(e.examples,3,160,'examples');
  if (Object.hasOwn(e,'tags')) strings(e.tags,6,30,'tags');
  if (Object.hasOwn(e,'synonyms')) strings(e.synonyms,6,40,'synonyms');
 });
 return structuredClone(raw);
}

// 仅用于素材查重。不会决定抽样、组合、互斥、NPC 行为或任何游戏状态。
export const normalize = text => text.normalize('NFKC').toLocaleLowerCase('en').replace(/[\p{P}\p{Z}\p{S}\s]/gu,'');
const signature = e => normalize(e.text??`${e.name}\n${e.description}`);
function grams(text) { const chars=[...normalize(text)]; return new Set(chars.slice(0,-1).map((c,i)=>c+chars[i+1])); }
export function duplicateReport(entries) {
 const exactGroups=new Map(), names=new Map(), inverted=new Map(), previous=[], near=[];
 for (const e of entries) {
  const key=signature(e); const group=exactGroups.get(key)??[]; group.push(e.id); exactGroups.set(key,group);
  if (e.name) { const nk=normalize(e.name); const group=names.get(nk)??[]; group.push(e.id); names.set(nk,group); }
  const gs=grams(e.text??`${e.name} ${e.description}`), candidates=new Map();
  // 高频字组不参与候选检索，避免数千条时形成全量两两比较；近似报告不是语义去重保证。
  for (const g of gs) {
   const hits=inverted.get(`${e.category}:${g}`)??[];
   if (hits.length<=200) for (const j of hits) candidates.set(j,(candidates.get(j)??0)+1);
  }
  for (const [j] of [...candidates].sort((a,b)=>b[1]-a[1]||a[0]-b[0]).slice(0,40)) {
   const p=previous[j], intersection=[...gs].filter(g=>p.gs.has(g)).length, score=intersection/(gs.size+p.gs.size-intersection);
   if (signature(e)!==signature(p.entry) && score>=0.58 && Math.min(gs.size,p.gs.size)>=6) near.push({a:p.entry.id,b:e.id,similarity:Number(score.toFixed(3))});
  }
  const j=previous.length; previous.push({entry:e,gs});
  for (const g of gs) { const key=`${e.category}:${g}`, hits=inverted.get(key)??[]; if (hits.length<=200) hits.push(j); inverted.set(key,hits); }
 }
 return {exact:[...exactGroups.values()].filter(g=>g.length>1),sameName:[...names.values()].filter(g=>g.length>1),near,
  note:'精确项用于阻止重复收录；同名与字面近似只供编辑审查。近义改写、语义雷同、错字仍需人工/审稿 AI 检查。'};
}
async function readJSON(file,fallback) {
 try { const text=await readFile(file,'utf8'); return JSON.parse(text.replace(/^\uFEFF/,'')); }
 catch(e) { if(e.code==='ENOENT' && fallback!==undefined)return structuredClone(fallback); throw e; }
}
export async function readBatch(file,options) {
 const {stat}=await import('node:fs/promises'); if ((await stat(file)).size>2*1024*1024) fail('交付文件超过 2 MiB。');
 return validateBatch(await readJSON(file),options);
}
export async function atomicJSON(file,value) {
 await mkdir(path.dirname(file),{recursive:true}); const tmp=`${file}.${randomUUID()}.tmp`;
 try {await writeFile(tmp,JSON.stringify(value,null,2)+'\n','utf8');await rename(tmp,file);}
 finally {await rm(tmp,{force:true});}
}
async function locked(root,work) {
 const base=path.resolve(root),lock=path.resolve(base,'management','.lock');
 if(!lock.startsWith(base+path.sep))fail('锁路径越出词库目录。');
 await mkdir(path.dirname(lock),{recursive:true});
 try {await mkdir(lock);} catch(e) {if(e.code==='EEXIST')fail('词库正在被另一个整理进程写入；请稍后重试，不要同时导入。');throw e;}
 try {return await work();} finally {await rm(lock,{recursive:true});}
}
export async function collection(root) {
 const batches=[];
 for (const c of catalog) {
  const dir=path.join(root,'collections',c.code); let files;
  try {files=await readdir(dir);} catch(e){if(e.code==='ENOENT')continue;throw e;}
  for (const file of files.sort()) if(file.endsWith('.json')) {
   const b=await readBatch(path.join(dir,file));
   if(b.library!==c.code || file!==b.batchId+'.json')fail('收录文件路径与批次身份不符。'); batches.push(b);
  }
 }
 const entries=batches.flatMap(b=>b.entries);
 if(new Set(entries.map(e=>e.id)).size!==entries.length)fail('已收录词库中存在重复 ID。');
 return {batches,entries};
}
export async function assignments(root) {return readJSON(path.join(root,'management','assignments.json'),{});}
async function reviews(root) {return readJSON(path.join(root,'management','reviews.json'),{});}
export async function tasks(root) {
 const extra=await readJSON(path.join(root,'management','extra-tasks.json'),[]);return [...initialPlan(),...extra];
}
export async function assign(root,batchId,producer) {
 string(producer,100,'领取人');
 return locked(root,async()=>{
  const task=(await tasks(root)).find(t=>t.batchId===batchId);if(!task)fail('任务不存在；扩充批次请先使用 extend。');
  const all=await assignments(root);
  if(all[batchId] && all[batchId]!==producer)fail(`批次已由 ${all[batchId]} 领取；不要重复派发相同 ID。`);
  all[batchId]=producer;await atomicJSON(path.join(root,'management','assignments.json'),all);return {...task,producer};
 });
}
export async function extend(root,library,producer,theme) {
 const c=catalog.find(c=>c.code===library);if(!c)fail('未知词库。');string(producer,100,'领取人');string(theme,500,'补充主题');
 return locked(root,async()=>{
  const all=await tasks(root),max=Math.max(0,...all.filter(t=>t.library===library).map(t=>Number(t.batchId.slice(-4))));
  if(max>=9999)fail('该词库批次编号已满；需升级格式，不得复用旧号。');
  const task={library,batchId:`${library}.b${String(max+1).padStart(4,'0')}`,size:50,theme,prompt:null};
  await atomicJSON(path.join(root,'management','extra-tasks.json'),[...all.filter(t=>!initialPlan().some(p=>p.batchId===t.batchId)),task]);
  const owners=await assignments(root);owners[task.batchId]=producer;await atomicJSON(path.join(root,'management','assignments.json'),owners);return {...task,producer};
 });
}
export async function importBatch(root,file) {
 return locked(root,async()=>{
  const b=await readBatch(file),task=(await tasks(root)).find(t=>t.batchId===b.batchId);
  if(!task)fail('未分配的批次；请先登记任务。');validateBatch(b,{expected:task});
  const owner=(await assignments(root))[b.batchId];if(!owner || owner!==b.source.producer)fail('来源 producer 与已领取任务不符。');
  const {batches,entries}=await collection(root),old=batches.find(p=>p.batchId===b.batchId);
  if(old) {if(digest(old)===digest(b))return {status:'unchanged',batchId:b.batchId};fail('已收录批次不可覆盖；修订需另开批次并在编辑记录中说明。');}
  const report=duplicateReport([...entries,...b.entries]),newIds=new Set(b.entries.map(e=>e.id));
  const duplicates=report.exact.filter(g=>g.some(id=>newIds.has(id)));
  if(duplicates.length)fail('存在精确重复，未写入。先审查去重并补足该批数量：'+JSON.stringify(duplicates));
  const index=await buildIndex(root,{batches:[...batches,b]});
  await atomicJSON(path.join(root,'collections',b.library,b.batchId+'.json'),b);
  await atomicJSON(path.join(root,'management','index.json'),index);
  return {status:'collected',batchId:b.batchId,count:b.entries.length,sameName:report.sameName.filter(g=>g.some(id=>newIds.has(id))),near:report.near.filter(p=>newIds.has(p.b))};
 });
}
async function buildIndex(root,overrides={}) {
 const stored=await collection(root),batches=overrides.batches??stored.batches,entries=batches.flatMap(b=>b.entries),review=overrides.review??await reviews(root),owners=await assignments(root);
 const usage=await readJSON(path.join(root,'management','usage.json'),{format:'aetheria-lexicon-usage',schemaVersion:1,bindings:[]});
 exact(usage,['format','schemaVersion','bindings']);
 if(usage.format!=='aetheria-lexicon-usage'||usage.schemaVersion!==1||!Array.isArray(usage.bindings))fail('使用登记格式错误。');
 const byId=new Map(entries.map(e=>[e.id,e]));
 const used=new Set();
 for(const b of usage.bindings) {
  exact(b,['entryId','targetFile','targetPointer','verifiedBy']);
  if(!byId.has(b.entryId)||review[b.entryId]?.status!=='approved')fail('使用登记必须指向已收录且已审定词条。');
  for(const key of ['targetFile','targetPointer','verifiedBy'])string(b[key],300,key);
  if(path.isAbsolute(b.targetFile)||b.targetFile.includes('..')||!b.targetPointer.startsWith('/'))fail('使用登记应为工程相对路径与 JSON Pointer。');
  used.add(b.entryId);
 }
 const index={format:'aetheria-lexicon-index',schemaVersion:1,
  totals:{collected:entries.length,approved:entries.filter(e=>review[e.id]?.status==='approved').length,used:used.size},
  libraries:catalog.map(c=>({library:c.code,target:c.target,collected:entries.filter(e=>e.category===c.code).length,approved:entries.filter(e=>e.category===c.code&&review[e.id]?.status==='approved').length,used:entries.filter(e=>e.category===c.code&&used.has(e.id)).length})),
  batches:batches.map(b=>({batchId:b.batchId,source:b.source,count:b.entries.length,hash:digest(b),file:`collections/${b.library}/${b.batchId}.json`})),
  tasks:(await tasks(root)).map(t=>({...t,producer:owners[t.batchId]??null,status:batches.some(b=>b.batchId===t.batchId)?'collected':owners[t.batchId]?'assigned':'unassigned'})),
  entries:entries.map(e=>({id:e.id,category:e.category,subcategory:e.subcategory,summary:e.name??e.text,review:review[e.id]?.status??'unreviewed',usageRecorded:used.has(e.id)})),
  note:'used 为经编辑登记的使用记录数，不证明游戏功能已实现；真实接入仍需检查目标文件与适配测试。示例、现有工程盘点不计入 collected。'};
 return index;
}
async function rebuildIndexUnlocked(root) {const index=await buildIndex(root);await atomicJSON(path.join(root,'management','index.json'),index);return index;}
export async function rebuildIndex(root) {return locked(root,()=>rebuildIndexUnlocked(root));}
export async function applyReview(root,file) {
 return locked(root,async()=>{
  const r=await readJSON(file);exact(r,['format','schemaVersion','reviewer','decisions']);
  if(r.format!=='aetheria-lexicon-review'||r.schemaVersion!==1)fail('不是审稿决定文件。');string(r.reviewer,100,'reviewer');
  if(!Array.isArray(r.decisions)||!r.decisions.length)fail('decisions 必须非空。');
  const ids=new Set((await collection(root)).entries.map(e=>e.id)),seen=new Set(),all=await reviews(root);
  for(const d of r.decisions) {
   exact(d,['id','status','note']);
   if(!ids.has(d.id)||seen.has(d.id)||!['approved','hold','rejected'].includes(d.status))fail('审稿 ID 未收录、重复或状态不合法。');
   string(d.note,500,'note');seen.add(d.id);all[d.id]={status:d.status,note:d.note,reviewer:r.reviewer};
  }
  // 先验证，后整体写入。AI 交付文件不能自行授予审定状态。
  const index=await buildIndex(root,{review:all});
  await atomicJSON(path.join(root,'management','reviews.json'),all);await atomicJSON(path.join(root,'management','index.json'),index);return {reviewed:r.decisions.length};
 });
}
export async function exportReviewed(root,output) {
 const {batches,entries}=await collection(root),review=await reviews(root);
 const origins=new Map(batches.flatMap(b=>b.entries.map(e=>[e.id,{source:b.source,batchId:b.batchId}])));
 const selected=entries.filter(e=>review[e.id]?.status==='approved');
 const out={format:'aetheria-lexicon-export',schemaVersion:1,
  entries:selected.map(e=>({entry:e,...origins.get(e.id),review:review[e.id]})),
  note:'纯素材交换文件。不是 ContentPack、ReferencePack 或文本槽扩展包；游戏不会自动加载。'};
 // 交换文件只写新路径，防止误覆盖源包、已收录文件或之前的导出。
 await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify(out,null,2)+'\n',{encoding:'utf8',flag:'wx'});return {exported:selected.length,output};
}
export async function contextSummary(root,library) {
 if(!catalog.some(c=>c.code===library))fail('未知词库。');
 const {entries}=await collection(root);
 const summary={format:'aetheria-lexicon-author-context',schemaVersion:1,library,
  entries:entries.filter(e=>e.category===library).map(e=>({id:e.id,subcategory:e.subcategory,
   ...(e.name?{name:e.name}:{}),summary:[...(e.text??e.description)].slice(0,160).join('')})),
  note:'供写作AI避开已收录名称、核心意象与表达骨架；不是游戏上下文，不含秘密剧情或生成规则。'};
 const output=path.join(root,'outbox',`context-${library}.json`);await atomicJSON(output,summary);return {output,count:summary.entries.length};
}
