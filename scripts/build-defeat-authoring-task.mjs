import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {slots,themes,pools,bindingRoles,facts} from '../production/collaboration-pack/catalog.mjs';
import {schemas} from '../production/collaboration-pack/schema.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const source='production/collaboration-pack';
const attachments=[];
for(const file of ['docs/01-通用规范.md','docs/07-两层格式与转换契约.md']){
  attachments.push([file,await readFile(path.join(root,source,file),'utf8'),'']);
}
attachments.push(['词池与绑定完整目录',JSON.stringify({specVersion:'1.3',slots,themes,pools,bindingRoles},null,2),'json']);
attachments.push(['事实查询完整目录',JSON.stringify({specVersion:'1.3',scope:'fixture-only；不是生产游戏能力证明',facts},null,2),'json']);
const registered=new Map();
async function scan(directory){
  for(const entry of await readdir(path.join(root,directory),{withFileTypes:true})){
    const file=directory+'/'+entry.name;
    if(entry.isDirectory())await scan(file);
    else if(entry.name.endsWith('.json')){
      const data=JSON.parse(await readFile(path.join(root,file),'utf8'));
      if(!data.manifest?.id||!Array.isArray(data.tags))continue;
      for(const tag of data.tags){
        if(registered.has(tag.id))throw Error('重复注册Tag：'+tag.id);
        registered.set(tag.id,{...tag,source:file});
      }
    }
  }
}
await scan('content');
const referenceIds=JSON.parse(await readFile(path.join(root,source,'tag-reference-ids.json'),'utf8'));
const groups={};
for(const [pool,ids]of Object.entries(referenceIds.pools)){
  groups[pool]=[];
  for(const id of ids){
    const tag=registered.get(id);
    if(!tag||tag.status!=='active')throw Error('参考Tag缺失或停用：'+id);
    groups[pool].push({canonicalId:tag.id,label:tag.label,definition:tag.definition,status:tag.status});
  }
}
const reference=JSON.stringify({specVersion:'1.3',usage:'当前工程实际注册的参考子集；Tag不证明现场事实；禁止据此声称全库查重',themes:referenceIds.themes,pools:groups},null,2);
attachments.push(['可用Tag参考子集（不支持全库查重）',reference,'json']);
for(const [name,schema] of Object.entries(schemas())){
  if(['word.schema.json','template.schema.json','delivery.schema.json'].includes(name))attachments.push([name,JSON.stringify(schema,null,2),'json']);
}
let output=await readFile(path.join(root,source,'战败内容制作任务.md'),'utf8');
output+='\n\n# 本任务必需输入全文\n\n以下为实际文件内容，不需要访问原工程。既有v1.3规范仍限定general；扩展设计说明不能改写该Schema。\n';
for(const [title,body,language]of attachments){
  if(language==='json')JSON.parse(body);
  output+='\n## 附录：'+title+'\n\n'+(language?'~~~'+language+'\n'+body+'\n~~~':body)+'\n';
}
for(const [,body]of attachments)if(!output.includes(body))throw Error('缺少附件正文');
await mkdir(path.join(root,'deliverables'),{recursive:true});
const destination=path.join(root,'deliverables/战败内容-独立协作任务.md');
await writeFile(destination,output,'utf8');
const saved=await readFile(destination,'utf8');
if(saved!==output)throw Error('写入读回不一致');
console.log(JSON.stringify({file:destination,bytes:Buffer.byteLength(output),embeddedInputs:attachments.length,sha256:createHash('sha256').update(output).digest('hex'),readBackVerified:true},null,2));
