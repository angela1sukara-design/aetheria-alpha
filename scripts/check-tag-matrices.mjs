import {readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {inflateRawSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {domains,rules,traits,facilities,services,ecologies,futureGaps,sourceKinds} from '../production/tag-matrices/spec.mjs';
import {safeExit,validateTraits} from '../production/tag-matrices/evaluate.mjs';
const out='deliverables/tag-matrices';
const sha=x=>createHash('sha256').update(x).digest('hex');
const load=async file=>JSON.parse(await readFile(file,'utf8'));
async function walk(dir){let files=[];for(const e of await readdir(dir,{withFileTypes:true})){const file=dir+'/'+e.name;if(e.isDirectory())files.push(...await walk(file));else files.push(file);}return files;}
export async function checkTagMatrices(){
 const manifest=await load(out+'/MANIFEST.json'),coverage=await load(out+'/00-覆盖报告.json'),ledger=await load(out+'/00-逐Tag覆盖账本.json'),sources=await load(out+'/00-来源指纹.json'),embedded=await load(out+'/00-全文校验索引.json'),materials=await load(out+'/00-未实装素材账本.json');
 assert.equal(domains.length,9);assert.equal(manifest.tasks.length,9);assert.equal(coverage.rules,rules.length);
 assert.equal(new Set(rules.map(x=>x.id)).size,rules.length);
 assert.equal(new Set(ledger.map(x=>x.id)).size,ledger.length);assert.equal(coverage.universe.registeredTags,ledger.length);
 const currentContent=(await walk('content')).filter(f=>f.endsWith('.json')).sort();
 assert.deepEqual(sources.filter(s=>s.file.startsWith('content/')).map(s=>s.file).sort(),currentContent,'content 文件集合变化，须重建');
 for(const s of sources)assert.equal(sha(await readFile(s.file)),s.sha256,'来源变化：'+s.file);
 for(const f of manifest.files){const b=await readFile(out+'/'+f.file);assert.equal(b.length,f.bytes);assert.equal(sha(b),f.sha256,'交付文件变化：'+f.file);}
 let embeddedFiles=0,sourceItems=0,cells=0,freeExitNodes=0,sourceRefs=0;
 const allSourceKeys=new Set(),allTemplateKeys=new Set();
 const matrices=await Promise.all(domains.map(d=>load(out+'/'+d.id+'-'+d.name+'-矩阵.json')));
 for(const m of matrices)for(const s of m.sourceItems){allSourceKeys.add(s.key);if(s.referenceId)allTemplateKeys.add(s.key);}
 const expectedSourceKeys=new Set();let expectedDefinitions=0,expectedTags=new Set();
 for(const file of currentContent){const p=await load(file);if(p.manifest&&Array.isArray(p.actions)){for(const [k,values]of Object.entries(p))if(Array.isArray(values)&&k!=='tags')assert.ok(k in sourceKinds,'新增定义类必须指定矩阵：'+k);for(const k of Object.keys(sourceKinds))for(const [i,v]of(p[k]??[]).entries()){expectedSourceKeys.add(file+'#'+k+'/'+(v.id??`${k}.${i}`));expectedDefinitions++;}for(const t of p.tags??[])expectedTags.add(t.id);}if(p.format==='aetheria-reference')for(const t of p.templates)expectedSourceKeys.add(file+'#templates/'+t.id);if(p.format==='aetheria-world-profiles')for(const profile of p.profiles){expectedSourceKeys.add(file+'#profiles/'+profile.id);expectedSourceKeys.add(file+'#questSources/'+profile.id);}if(p.format==='aetheria-quest-catalog')for(const q of p.entries)expectedSourceKeys.add(file+'#questSources/ecology:'+q.environmentTag);}
 const editorialBase='production/tag-deliveries/2026-10-12/general-expansion-v2',taxonomy=await load(editorialBase+'/taxonomy.json'),hints=await load(editorialBase+'/rule-hints.json');
 for(const h of hints)expectedSourceKeys.add(editorialBase+'/rule-hints.json#hints/'+h.conceptId);
 for(const r of taxonomy.rules)expectedSourceKeys.add(editorialBase+'/taxonomy.json#rules/'+r.id);
 assert.deepEqual([...allSourceKeys].sort(),[...expectedSourceKeys].sort(),'源项漏覆盖或多算');assert.equal(expectedDefinitions,coverage.universe.definitions);assert.deepEqual(ledger.map(t=>t.id).sort(),[...expectedTags].sort(),'Tag漏登记');
 assert.equal(coverage.universe.editorialRuleHints,hints.length);assert.equal(coverage.universe.editorialConcepts,taxonomy.concepts.length);assert.equal(coverage.universe.lexicalRules,taxonomy.rules.length);
 for(const c of taxonomy.concepts)assert.deepEqual(ledger.find(t=>t.id===c.id)?.editorialDefinition,c,'概念维度漏同步 '+c.id);
 for(const m of matrices){
  assert.equal(new Set(m.cells.map(c=>c.key)).size,m.cells.length,'格ID重复 '+m.id);
  assert.equal(new Set(m.sourceItems.map(s=>s.key)).size,m.sourceItems.length,'源项重复 '+m.id);
  assert.equal(m.coverage.cells,m.cells.length);assert.equal(m.coverage.sourceItems,m.sourceItems.length);
  assert.deepEqual(m.rules,rules.filter(r=>r.domains.includes(m.id)).map(r=>r.id));
  assert.deepEqual(m.ruleDefinitions,rules.filter(r=>r.domains.includes(m.id)));
  for(const c of m.cells){assert.ok(c.status||c.expected,'缺状态 '+c.key);for(const r of c.required??c.requirements??[])assert.ok(m.rules.includes(r),'不适用规则 '+c.key+':'+r);if(c.source){assert.ok(allSourceKeys.has(c.source),'失效源引用 '+c.source);sourceRefs++;}for(const k of c.candidates??[])assert.ok(allSourceKeys.has(k),'失效候选 '+k);}
  for(const n of m.sourceItems.filter(s=>s.kind==='narrativeNodes'&&!s.status.startsWith('范围外'))){assert.ok(n.payload.choices.some(safeExit),'无免费退出 '+n.id);assert.ok(n.payload.maxVisits>0&&Number.isFinite(n.payload.maxVisits));freeExitNodes++;}
  for(const g of futureGaps.filter(g=>g.domains.includes(m.id)))assert.ok(m.gaps.some(x=>x.id===g.id));
  for(const t of ledger.filter(t=>t.domains.includes(m.id)||t.domains.includes('00')))assert.ok(m.tagLedger.some(x=>x.id===t.id),'Tag漏账 '+t.id);
  sourceItems+=m.sourceItems.length;cells+=m.cells.length;
 }
 assert.equal(matrices[0].cells.filter(c=>c.family==='题材生态地点').length,coverage.universe.worldProfiles*ecologies.length*services.length*4);
 assert.equal(matrices[2].cells.filter(c=>c.family==='设施服务真值表').length,2**facilities.length*2*8);
 assert.equal(matrices[3].cells.filter(c=>c.family==='性格对话后果').length,traits.length*5*2*4);
 assert.equal(matrices[5].cells.filter(c=>c.family==='任务源覆盖').length,coverage.universe.questSourceRows);
 const enemies=matrices[6].sourceItems.filter(s=>s.kind==='enemies');
 assert.equal(matrices[6].cells.filter(c=>c.family==='战斗题材审计').length,coverage.universe.worldProfiles*enemies.length*5);
 assert.equal(matrices[8].cells.filter(c=>c.family==='关系路线规划').length,3*6*7);
 assert.equal(matrices[8].cells.filter(c=>c.family==='关系门槛边界全集').length,6*6*8*2*2);
 for(const m of matrices)for(const r of m.sourceItems.filter(s=>s.kind==='residentTemplates')){if(r.payload.traitTags)assert.ok(validateTraits(r.payload.traitTags,ledger,traits));for(const v of r.payload.traitVariants??[])assert.ok(validateTraits(v.traitTags,ledger,traits));}
 assert.equal(new Set(materials.uniqueEntries.map(x=>x.id)).size,materials.uniqueEntries.length);assert.equal(materials.uniqueEntries.length,coverage.universe.uniqueRawMaterials);
 const semanticRows=(await readFile(materials.semanticSource,'utf8')).trim().split(/\r?\n/).map(JSON.parse),expectedMaterialIds=new Set(semanticRows.map(r=>r.sourceEntryId));
 for(const b of materials.batches)for(const e of(await load(b.file)).entries)expectedMaterialIds.add(e.id);
 assert.deepEqual(materials.uniqueEntries.map(e=>e.id).sort(),[...expectedMaterialIds].sort(),'原始/v2素材漏账或导出副本重复计数');
 assert.equal(semanticRows.length,coverage.universe.semanticMaterials);
 const indexedBatches=new Set(materials.batches.map(b=>b.file));
 for(const root of materials.roots)for(const f of (await walk(root)).filter(f=>f.endsWith('.json'))){let data;try{data=await load(f);}catch{continue;}if(['aetheria-lexicon-batch','aetheria-nsfw-lexicon-batch'].includes(data.format)&&Array.isArray(data.entries))assert.ok(indexedBatches.has(f),'新增素材批次须重建：'+f);}
 for(const e of embedded){const text=await readFile(out+'/'+e.file,'utf8');for(const f of e.embedded){assert.equal(sha(Buffer.from(text.slice(f.offset,f.offset+f.length))),f.sha256,e.id+':'+f.file);assert.equal(sha(await readFile(f.file)),f.sha256,'内嵌源码过期 '+f.file);embeddedFiles++;}const matrixText=text.slice(e.matrix.offset,e.matrix.offset+e.matrix.length);assert.equal(sha(matrixText),e.matrix.sha256);assert.deepEqual(JSON.parse(matrixText),matrices.find(m=>m.id===e.id),'独立任务矩阵缺内容 '+e.id);}
 // 读回实际 ZIP，而非只验证压缩前的 Buffer。
 const zip=await readFile('deliverables/Tag组合规则与九类矩阵-2026-10-15.zip');let offset=0,zipEntries=0;
 while(zip.readUInt32LE(offset)===0x04034b50){const method=zip.readUInt16LE(offset+8),size=zip.readUInt32LE(offset+18),rawSize=zip.readUInt32LE(offset+22),nameSize=zip.readUInt16LE(offset+26),extraSize=zip.readUInt16LE(offset+28),name=zip.subarray(offset+30,offset+30+nameSize).toString('utf8'),start=offset+30+nameSize+extraSize;assert.equal(method,8);const data=inflateRawSync(zip.subarray(start,start+size));assert.equal(data.length,rawSize);const file=name.replace(/^Tag组合与九类矩阵\//,'');assert.ok(!file.includes('..'));assert.deepEqual(data,await readFile(out+'/'+file));offset=start+size;zipEntries++;}
 assert.equal(zipEntries,manifest.files.length+1);assert.equal(zip.readUInt32LE(offset),0x02014b50);
 return {status:'passed',scope:'制作规则与九类有限覆盖矩阵',matrices:9,rules:rules.length,registeredTags:ledger.length,editorialConcepts:taxonomy.concepts.length,editorialRuleHints:hints.length,lexicalRules:taxonomy.rules.length,uniqueSourceItems:allSourceKeys.size,sourceAssignments:sourceItems,cells,sourceRefs,freeExitNodes,embeddedFiles,zipEntries,rawMaterials:materials.uniqueEntries.length,rawConflicts:materials.conflicts.length,runtimeChanged:false,notes:['矩阵数不等于可达剧情数','缺接口、范围外与原始素材逐项保留，不计玩法完成','原始素材冲突保留人工裁定，不自动覆盖']};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const report=await checkTagMatrices();await writeFile('artifacts/tag-matrices-verification.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
