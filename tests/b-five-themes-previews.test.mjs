import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assembleProse} from '../production/tag-matrices/assembly.mjs';
import {loadBundle} from '../production/collaboration-pack/load-source.mjs';
import {validateDelivery} from '../production/collaboration-pack/tools/authoring.mjs';
const read=async p=>JSON.parse(await readFile(new URL('../'+p,import.meta.url),'utf8'));
test('ten corrected deliveries validate and all 40 real assembler previews replay exactly',async()=>{
  const source=await read('content/prose/b-five-themes-v2.json'),bundle=await loadBundle();
  for(const d of source.deliveries){validateDelivery(d,bundle);if(d.task==='B2')assert(d.handPreviews.some(p=>p.entryIds.some(id=>id.startsWith('word.form.'))));}
  const cases=await read('tests/fixtures/b-five-themes-preview-replay.json');assert.equal(cases.length,40);
  for(const c of cases){const result=assembleProse(c.input);assert.equal(result.mode,'assembled');assert.equal(result.text,c.expectedText);assert(!result.text.includes('其中盛着过滤水'));}
});
