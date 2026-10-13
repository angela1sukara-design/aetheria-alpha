/**
 * 将 general-expansion-v2 编辑概念装入默认加载 TagDef 包。
 * 不批准 NSFW；不写 proseMaterials.approved。
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const taxPath = path.join(root, 'production/tag-deliveries/2026-10-12/general-expansion-v2/taxonomy.json');
const outDir = path.join(root, 'content/general-lexicon');

const FACET_MAP_EXACT = { ecology: 'ecology', body: 'body', 'setting-context': 'setting', 'service-state': 'service' };
const BODY = ['body', 'adaptation', 'appearance', 'posture', 'garment', 'accessory', 'surface', 'covering', 'tf', 'measurement'];
const SETTING = ['setting', 'weather', 'terrain', 'place', 'facility', 'hydrology', 'lighting', 'airflow', 'scent', 'sound', 'environment', 'space', 'plant', 'industrial', 'vehicle', 'household', 'enclosure', 'shelter', 'occupancy', 'visibility', 'moisture', 'temperature', 'gravity', 'hazard', 'passage', 'access', 'vertical', 'spatial', 'clearance', 'step-access', 'air-'];
const SERVICE = ['service', 'occupation', 'administration', 'trade', 'institution', 'work-process', 'work-object'];
const CONTEXT = ['disposition', 'emotion', 'habit', 'value', 'goal', 'history', 'interest', 'relationship', 'interaction', 'speech', 'expression', 'identity', 'narration', 'activity', 'occasion', 'continuity', 'time', 'condition', 'tenure'];

function mapFacet(facet, role) {
  if (FACET_MAP_EXACT[facet]) return FACET_MAP_EXACT[facet];
  if (BODY.some(p => facet === p || facet.startsWith(p))) return 'body';
  if (SETTING.some(p => facet === p || facet.startsWith(p))) return 'setting';
  if (SERVICE.some(p => facet === p || facet.startsWith(p))) return 'service';
  if (CONTEXT.some(p => facet === p || facet.startsWith(p))) return 'context';
  return role === 'qualifier' ? 'context' : 'theme';
}

const tax = JSON.parse(await readFile(taxPath, 'utf8'));
if (tax.domain !== 'general') throw new Error('source domain must be general');
const tags = [];
const statusCounts = {};
for (const c of tax.concepts) {
  statusCounts[c.status] = (statusCounts[c.status] ?? 0) + 1;
  const definition = (c.definition || `${c.label}（通用候选词条；不证明实体状态或玩法效果）。`).slice(0, 2000);
  tags.push({
    id: c.id,
    label: c.label,
    definition,
    facets: [mapFacet(c.facet || 'theme', c.role || 'core')],
    status: 'active',
    aliases: [{ scope: 'lexicon.v2', value: c.id }],
  });
}

const pack = {
  manifest: {
    id: 'aetheria/general-lexicon',
    namespace: 'general-taxonomy',
    version: '1.0.0',
    schemaVersion: 2,
    engineApiVersion: '0.1',
    author: 'General lexicon runtime install (candidate TagDefs)',
    status: 'reviewed',
    dependencies: [{ id: 'engine/core', version: '0.1.0', optional: false }],
    requiresCapabilities: ['foundation.v2'],
    migrations: [],
  },
  variables: [],
  flags: [],
  hooks: [],
  locations: [],
  routes: [],
  actions: [],
  events: [],
  texts: { 'general-taxonomy:text.install': '通用候选词条已装入默认加载路径；词条≠审定通过的玩法效果。' },
  contributions: [],
  tags,
};

await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, 'pack.json'), JSON.stringify(pack, null, 2) + '\n');
const receipt = {
  format: 'aetheria-general-lexicon-install-receipt',
  installedAt: new Date().toISOString(),
  source: 'production/tag-deliveries/2026-10-12/general-expansion-v2/taxonomy.json',
  domain: 'general',
  nsfwTouched: false,
  reviewPolicy: 'TagDef status=active for load path; editorial reviewStatus remains candidate/proposed; do NOT write approved into NSFW or unreviewed materials',
  counts: { sourceConcepts: tax.concepts.length, installedTags: tags.length, skipped: 0 },
  sourceStatuses: statusCounts,
};
await writeFile(path.join(outDir, 'INSTALL-RECEIPT.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(`Installed ${tags.length} general TagDefs → content/general-lexicon/pack.json`);
