import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {rules as checks} from '../production/tag-matrices/spec.mjs';
import {validateAssemblyCatalog} from '../production/tag-matrices/assembly.mjs';
const sha=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const sourcePath='content/prose/a-templates-v2.json',planPath='production/text-slot-integration/a-templates-v1.json';
const assembler=await fs.readFile('production/tag-matrices/assembly.mjs','utf8'),checkIds=checks.map(r=>({id:r.id}));
if(process.argv.includes('--install')){
 const {loadBundle}=await import('../production/collaboration-pack/load-source.mjs');
 const {validateDelivery,convertTemplate}=await import('../production/collaboration-pack/tools/authoring.mjs');
 const bundle=await loadBundle(),deliveries=(await read(sourcePath)).deliveries;
 for(const d of deliveries)validateDelivery(d,bundle);
 const source={format:'aetheria-reviewed-a-templates',version:2,deliveries};
 const catalog={...structuredClone(bundle.baseCatalog),rules:deliveries.flatMap(d=>d.entries.map(e=>convertTemplate(e,bundle)))};
 await fs.writeFile(sourcePath,JSON.stringify(source,null,2)+'\n');
 await fs.writeFile(planPath,JSON.stringify({version:1,scope:'general-live-observation',sourceHash:sha(source),assemblerHash:sha(assembler),checksHash:sha(checkIds),catalogHash:sha(catalog),catalog},null,2)+'\n');
}
const source=await read(sourcePath),plan=await read(planPath);
assert.equal(plan.sourceHash,sha(source),'Template source changed: explicit re-review required.');assert.equal(plan.assemblerHash,sha(assembler),'Assembler changed: explicit re-review required.');assert.equal(plan.checksHash,sha(checkIds));
assert.equal(plan.catalogHash,sha(plan.catalog),'Reviewed runtime rules changed: explicit re-review required.');
validateAssemblyCatalog(plan.catalog);assert.equal(plan.catalog.rules.length,54);assert.equal(new Set(plan.catalog.rules.map(r=>r.id)).size,54);
assert(plan.catalog.rules.every(r=>r.contentTier==='general'&&r.fallbackTier==='general'));
await fs.writeFile('src/world/a-template-data.ts',`// Generated from fingerprinted A1/A2/A3 source.\nimport type {ProseCatalog} from '../core/prose-types.ts';\nexport const A_TEMPLATE_CATALOG:ProseCatalog=${JSON.stringify(plan.catalog,null,2)};\n`);
// Preserve one canonical implementation. The generated vendor module is JavaScript
// with a .ts extension for this repo's browser bundler; the adapter has typed inputs.
const runtime=assembler.replace("import {proseProblem} from '../../src/content/player-prose.ts';","import {proseProblem} from '../content/player-prose.ts';").replace("import {rules as sharedRules} from './spec.mjs';",`const sharedRules=${JSON.stringify(checkIds)};`);
await fs.writeFile('src/engine/prose-assembly.generated.ts','// @ts-nocheck\n// Generated verbatim from the fingerprinted reference assembler; do not edit.\n'+runtime);
console.log('A1/A2/A3 installed: 54 frozen templates and canonical runtime assembler.');
