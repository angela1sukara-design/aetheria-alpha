import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { stableJson } from '../src/core/types.ts';
import { parseQuestContent } from '../src/content/quest-schema.ts';
import { buildNeighborhoodQuests } from './build-neighborhood-quests.mjs';
import { buildWorldProfiles } from './build-world-profiles.mjs';

const root = 'production/quest-authoring/cyber-apex/';
const source = JSON.parse(await readFile(root + 'quest-tree.json', 'utf8'));
const execution = JSON.parse(await readFile(root + 'execution.json', 'utf8'));
const content = parseQuestContent({ format: 'aetheria-quest-content', schemaVersion: 1, id: 'aetheria/cyber-apex', version: '1.0.0', sourceHash: createHash('sha256').update(stableJson(source)).digest('hex'), source, execution });
await writeFile('content/generation/cyber-apex.json', JSON.stringify(content, null, 2) + '\n');
console.log('Cyber apex: offline authored choices validated and packaged.');
await buildNeighborhoodQuests();
await buildWorldProfiles();
