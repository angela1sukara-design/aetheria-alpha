import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { loadPacks } from '../src/content/loader.ts';
import { WorldGenerator, GENERATOR_VERSION } from '../src/world/generator.ts';
import { SaveCodec } from '../src/persistence/codec.ts';
const read = async p => JSON.parse(await readFile(p, 'utf8'));
const index = await read('content/index.json');
const registry = await loadPacks([...await Promise.all(index.packs.map(p => read('content/' + p))), await read('content/generation/neighborhood-content.json'), await read('content/generation/lexicon-content.json')]);
const rules = await read('content/generation/rules.json'), reference = await read('content/generation/lexicon-reference.json');
const html = await readFile('dist/Aetheria-Alpha-0.2.html', 'utf8');
await mkdir('dist/worlds', { recursive: true });
const summaries = [];
for (const seed of [7, 42]) {
  const world = await new WorldGenerator().generate({ seed, registry, rules, references: [reference] });
  const save = await new SaveCodec(world.registry).encode(world.state);
  await writeFile(`dist/worlds/seed-${seed}.json`, save);
  const launch = `globalThis.aetheriaInitialSave=${JSON.stringify(save).replaceAll('<','\\u003c')};globalThis.aetheriaSaveSlot="worldgen-${GENERATOR_VERSION}-seed-${seed}";`;
  await writeFile(`dist/WorldGenerator-Seed-${seed}.html`, html.replace('<script>globalThis.aetheriaEmbedded=', () => '<script>' + launch + 'globalThis.aetheriaEmbedded='));
  summaries.push({ seed, name: world.world.definition.name, environment: world.world.definition.regions[0].environmentTags, locations: world.world.definition.locations.length, residents: world.state.district.residents.length, rulesHash: world.world.generation.rulesHash, references: world.world.generation.references, contentPacks: world.world.generation.contentPacks });
}
await writeFile('dist/worlds/manifest.json', JSON.stringify({ generatorVersion: GENERATOR_VERSION, worlds: summaries }, null, 2));
console.log('Two offline generated neighborhoods and self-contained initial saves built (seeds 7, 42).');
