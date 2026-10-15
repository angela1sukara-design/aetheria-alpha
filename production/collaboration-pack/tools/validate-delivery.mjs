import {readFile} from 'node:fs/promises';
import {loadBundle} from './load.mjs';
import {validateDelivery,validateTagBatch} from './authoring.mjs';
const file=process.argv[2];if(!file)throw Error('用法：node tools/validate-delivery.mjs 提交文件.json');
const data=JSON.parse(await readFile(file,'utf8')),bundle=await loadBundle();if(data.task==='T1')validateTagBatch(data,bundle);else validateDelivery(data,bundle);
console.log(JSON.stringify({status:'authoring-format-passed',entries:data.entries?.length??data.suggestedTags.length,draft:data.entries?.filter(e=>e.review==='draft').length??0,hold:data.entries?.filter(e=>e.review==='hold').length??0,warning:'不代表事实完整、审批通过、正式配额达标或游戏已接入。'},null,2));
