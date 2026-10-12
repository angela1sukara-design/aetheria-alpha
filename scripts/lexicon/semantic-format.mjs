import { exact } from './library.mjs';
import { loadPacks } from '../../src/content/loader.ts';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const text=(v,max=500)=>{if(typeof v!=='string'||!v.trim()||v!==v.trim()||v.length>max)throw Error('素材文字或管理字段无效。');};
/** v2 是纯素材交换入口；不自动审核、不注册玩法、不接受外部旧 NSFW 格式冒充兼容。 */
export function validateSemanticBatch(raw,registry){
  exact(raw,['format','schemaVersion','batchId','library','domain','source','dictionary','entries']);
  if(raw.format!=='aetheria-lexicon-materials'||raw.schemaVersion!==2)throw Error('需要 aetheria-lexicon-materials v2；外部 NSFW 批次需显式转换。');
  if(!['general','nsfw'].includes(raw.domain))throw Error('素材域无效。');
  if(typeof raw.library!=='string'||!/^[a-z][a-z0-9-]{1,63}$/.test(raw.library)||raw.domain==='nsfw'&&!raw.library.startsWith('nsfw-'))throw Error('管理分类代码无效。');
  if(raw.batchId!==`${raw.library}.${raw.batchId?.split('.').at(-1)}`||!new RegExp(`^${raw.library}\\.b[0-9]{4}$`).test(raw.batchId)||raw.batchId.endsWith('0000'))throw Error('批次 ID 无效。');
  exact(raw.source,['producer','model','theme']);Object.values(raw.source).forEach(v=>text(v));
  exact(raw.dictionary,['id','version','hash']);const installed=registry.packs.find(p=>p.id===raw.dictionary.id);if(!installed||installed.version!==raw.dictionary.version||installed.hash!==raw.dictionary.hash)throw Error('字典版本或原始内容哈希不匹配。');
  if(!Array.isArray(raw.entries)||!raw.entries.length||raw.entries.length>50)throw Error('每个 v2 内部批次需 1–50 条。整包可包含多个文件。');
  raw.entries.forEach((e,i)=>{
    exact(e,['id','category','subcategory','text','description','tags','classification'],['synonyms']);
    if(e.id!==`lx.${raw.batchId}.${String(i+1).padStart(4,'0')}`||e.category!==raw.library)throw Error('稳定 ID 或分类错配。');
    text(e.subcategory,80);text(e.text,400);text(e.description,240);
    if(!Array.isArray(e.tags)||e.tags.length>6||new Set(e.tags).size!==e.tags.length)throw Error('语义引用数组无效。');
    for(const id of e.tags){const tag=registry.tag(id);if(tag.status!=='active')throw Error('新素材不可引用废弃 Tag。');}
    if(e.synonyms){if(!Array.isArray(e.synonyms)||e.synonyms.length>6)throw Error('同义文本数组无效。');e.synonyms.forEach(v=>text(v,40));}
    exact(e.classification,['tier','preferenceKey','eligibility']);
    const c=e.classification;
    if(raw.domain==='general'){if(c.tier!=='general'||c.preferenceKey!==null||c.eligibility!=='general')throw Error('普通素材分级无效。');}
    else if(c.tier!=='adult_optional'||c.preferenceKey!=='adultOptional'||c.eligibility!=='verified-adults')throw Error('NSFW 元数据必须声明专用偏好及全体参与者成年资格；Tag 不证明资格。');
  });
  return structuredClone(raw);
}
export async function dictionaryRegistry(project){const index=JSON.parse(await readFile(path.join(project,'content/index.json'),'utf8'));return loadPacks(await Promise.all(index.packs.map(async p=>JSON.parse(await readFile(path.join(project,'content',p),'utf8')))));}
