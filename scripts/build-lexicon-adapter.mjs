import { readFile } from 'node:fs/promises';
import { collection, digest, atomicJSON } from './lexicon/library.mjs';
import { compileNeighborhood } from './lexicon/neighborhood.mjs';
import { loadPacks } from '../src/content/loader.ts';
import { parseReference } from '../src/world/schema.ts';
const read = async file => JSON.parse(await readFile(file,'utf8'));
const root = 'production/lexicon-authoring';
const stored = await collection(root), index = await read(`${root}/management/index.json`);
for (const batch of stored.batches) if (index.batches.find(b => b.batchId === batch.batchId)?.hash !== digest(batch)) throw Error(`收录文件与登记哈希不符：${batch.batchId}`);
const output = compileNeighborhood({reference:await read('content/generation/reference.json'),content:await read('content/generation/neighborhood-content.json'),entries:stored.entries,reviews:await read(`${root}/management/reviews.json`),selection:await read(`${root}/adapters/neighborhood-v0.1.json`)});
const fixed = await read('content/index.json');
const registry = await loadPacks([...await Promise.all(fixed.packs.map(p => read('content/'+p))),await read('content/generation/neighborhood-content.json'),output.content]);
parseReference(output.reference,registry);
// 完整校验后才发布可运行文本。审稿状态由编辑流程授予，构建不自动批准条目。
await atomicJSON('content/generation/lexicon-content.json',output.content);
await atomicJSON('content/generation/lexicon-reference.json',output.reference);
// 用途账本属于编辑记录，由独立命令登记，普通构建保持源目录只读。
if (process.argv.includes('--record-usage')) await atomicJSON(`${root}/management/usage.json`,output.usage);
console.log(`Reviewed lexicon adapter built: ${new Set(output.usage.bindings.map(b=>b.entryId)).size} entries, ${output.usage.bindings.length} verified text bindings.`);
