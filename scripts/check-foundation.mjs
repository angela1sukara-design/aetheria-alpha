import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { loadPacks } from '../src/content/loader.ts';
import { parseReference, parseRules, hash } from '../src/world/schema.ts';
import { validateReferenceOrder } from '../src/world/reference-validation.ts';
import { resolveTag } from '../src/content/tags.ts';
import { validateSemanticBatch } from './lexicon/semantic-format.mjs';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const index=await read('content/index.json'),r=await loadPacks(await Promise.all(index.packs.map(p=>read('content/'+p))));
const source=await loadPacks([...r.contentPacks,await read('content/generation/neighborhood-content.json'),await read('content/generation/lexicon-content.json')]);
const references=await Promise.all(['reference','lexicon-reference'].map(n=>read(`content/generation/${n}.json`)));
references.forEach(p=>parseReference(p,source));
const pack=r.packs.find(p=>p.id==='aetheria/foundation');
const output='production/lexicon-authoring/formats/v2';
if(process.argv.includes('--write-examples')){
  await mkdir(output,{recursive:true});
  const common={format:'aetheria-lexicon-materials',schemaVersion:2,source:{producer:'format-example',model:'unknown',theme:'中性格式验收，不含成人正文'},dictionary:pack};
  for(const domain of ['general','nsfw']){const library=domain==='general'?'body-detail':'nsfw-format-sample',batchId=library+'.b0001';const example={...common,domain,library,batchId,entries:[{id:`lx.${batchId}.0001`,category:library,subcategory:'format-sample',text:'格式验收占位文本。',description:'仅示范素材字段，不代表已经实现玩法。',tags:['foundation:theme.transformation'],classification:domain==='general'?{tier:'general',preferenceKey:null,eligibility:'general'}:{tier:'adult_optional',preferenceKey:'adultOptional',eligibility:'verified-adults'}}]};await writeFile(output+`/${domain}-example.json`,JSON.stringify(example,null,2)+'\n');}
  const referenceReferences=[];
  for(const reference of references){const source={id:reference.id,version:reference.version,hash:await hash(reference)};const visit=(value,pointer)=>{if(Array.isArray(value))value.forEach((v,i)=>visit(v,`${pointer}/${i}`));else if(value&&typeof value==='object')Object.entries(value).forEach(([k,v])=>visit(v,`${pointer}/${k}`));else if(typeof value==='string'&&/\/(tags|environmentTags|requiresTags|excludesTags|compatibleTags)\/\d+$|\/tag$/.test(pointer))referenceReferences.push({tagId:resolveTag(r,value,'generation.v1'),source,path:pointer});};visit(reference,'');}
  await writeFile(output+'/tag-dictionary.json',JSON.stringify({format:'aetheria-tag-export',schemaVersion:1,source:pack,tags:r.tags,references:r.tagReferences,referenceReferences},null,2)+'\n');
  const example={manifest:{id:'authoring/foundation-example',namespace:'authoring',version:'1.0.0',schemaVersion:2,engineApiVersion:'0.1',author:'Reviewed neutral format example',status:'reviewed',dependencies:r.packs.map(p=>({id:p.id,version:p.version,optional:false})),requiresCapabilities:['foundation.v2','body.graph.v1','tf.pipeline.v1','condition.v1','effect.v1','hook.action.v1'],migrations:[]},variables:[],flags:[],hooks:[],locations:[],routes:[],events:[],texts:{'authoring:text.done':'尾部参数已经通过身体补丁更新。'},actions:[{id:'authoring:action.tail-tone',label:'示例尾部涂层',hint:'仅供内容作者校验示例',group:'daily',surface:'body',conditions:[{op:'body.matches',target:{kind:'player'},part:{kind:'tail',instanceId:'tail'}}],effects:[{op:'tf.apply',id:'authoring:tf.tail-tone',target:{kind:'player'}}],resultText:'authoring:text.done'}],contributions:[{hookId:'aetheria-tf:hook.body',actionIds:['authoring:action.tail-tone']}],bodyPatches:[{id:'authoring:patch.tail-tone',label:'尾部参数示例',summary:'明确材料、形态和长度',operations:[{type:'attributes',partId:'tail',set:{materialId:'foundation:material.alloy',morphologyId:'foundation:morphology.tail',color:'silver',lengthMm:650},unset:[]}]}],transformations:[{id:'authoring:tf.tail-tone',label:'尾部参数示例',source:'free',stages:[{id:'apply',atMinutes:0,label:'完成',patchId:'authoring:patch.tail-tone'}]}],proseMaterials:[{id:'authoring:prose.tail',text:'尾部表面泛着银色光泽，转身时需要留出空间。',tags:['foundation:body.mechanical-tail'],source:'neutral-authoring-example',review:'approved',tier:'general'}],proseSelections:[{id:'authoring:selection.tail',entryId:'authoring:prose.tail',channel:'body',when:[{op:'body.matches',target:{kind:'player'},part:{kind:'tail',materialFamily:'mechanical',minLengthMm:600}}]}]};
  await writeFile(output+'/content-pack-example.json',JSON.stringify(example,null,2)+'\n');
}
for(const domain of ['general','nsfw'])validateSemanticBatch(await read(output+`/${domain}-example.json`),r);
await loadPacks([...r.contentPacks,await read(output+'/content-pack-example.json')]);
const ruleRegistry=await loadPacks([...source.contentPacks,await read(output+'/rule-authoring/rules-content-example.v2.json')]);
const ruleReference=parseReference(await read(output+'/rule-authoring/reference-addon-example.v2.json'),ruleRegistry);
parseRules(await read(output+'/rule-authoring/generation-rules-example.v1.json'));
validateReferenceOrder([...references[0].templates,...ruleReference.templates]);
console.log(`Foundation format checks passed: ${r.tags.length} Tags, ${r.tags.reduce((n,t)=>n+t.aliases.length,0)} scoped legacy aliases, 2 semantic batch examples, 1 content pack example, 2 reference libraries, 3 rule-authoring examples. No prose imported or auto-approved.`);
