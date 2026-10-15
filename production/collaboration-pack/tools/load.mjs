import {readFile} from 'node:fs/promises';
export const root=new URL('../',import.meta.url);
export const readJSON=async file=>JSON.parse(await readFile(new URL(file,root),'utf8'));
export async function loadBundle(){return {schemas:{word:await readJSON('schemas/word.schema.json'),template:await readJSON('schemas/template.schema.json'),delivery:await readJSON('schemas/delivery.schema.json'),proposal:await readJSON('schemas/proposal.schema.json'),tagBatch:await readJSON('schemas/tagBatch.schema.json')},pools:await readJSON('02-词池总表.json'),facts:await readJSON('09-事实目录.json'),tags:await readJSON('08-全量注册Tag快照.json'),baseCatalog:await readJSON('assembly-rules.json')};}
