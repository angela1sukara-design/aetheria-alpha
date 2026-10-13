#!/usr/bin/env node
/**
 * Map aetheria-nsfw-lexicon-batch (v1) → aetheria-lexicon-materials (v2).
 * Purpose: explicit conversion for validate-v2 acceptance only.
 * Does NOT import into collections, ContentPack, or runtime.
 * Free-text v1 tags are dropped from the v2 tags[] (must be foundation: IDs);
 * they are recorded in sidecar *.tag-notes.json for editors.
 */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dictionaryRegistry, validateSemanticBatch } from './semantic-format.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const srcDir = path.join(root, 'docs/tag-hub/nsfw-batches');
const outDir = path.join(srcDir, 'v2-draft');

const filter = process.argv[2]; // optional substring e.g. b0017

function text(v, max, label) {
  if (typeof v !== 'string' || !v.trim() || v !== v.trim() || v.length > max) {
    throw Error(`${label} 无效或超长（≤${max}）：${JSON.stringify(v)?.slice(0, 80)}`);
  }
}

async function mapBatch(file, dictionary) {
  const raw = JSON.parse(await readFile(file, 'utf8'));
  if (raw.format !== 'aetheria-nsfw-lexicon-batch' || raw.schemaVersion !== 1) {
    throw Error(`不是 v1 NSFW 批次：${path.basename(file)}`);
  }
  if (!raw.library?.startsWith('nsfw-')) throw Error(`library 必须以 nsfw- 开头：${raw.library}`);
  if (raw.entries.length < 1 || raw.entries.length > 50) {
    throw Error(`v2 单批 1–50 条，当前 ${raw.entries.length}：${raw.batchId}`);
  }

  const entries = raw.entries.map((e, i) => {
    const id = `lx.${raw.batchId}.${String(i + 1).padStart(4, '0')}`;
    if (e.id && e.id !== id) throw Error(`稳定 ID 与序号不符：${e.id} ≠ ${id}`);
    text(e.name, 400, 'name→text');
    text(e.description, 240, 'description');
    text(e.subcategory || 'unspecified', 80, 'subcategory');
    return {
      id,
      category: raw.library,
      subcategory: e.subcategory || 'unspecified',
      text: e.name,
      description: e.description,
      tags: [], // 不把中文自由 tag 冒充 foundation: ID
      classification: {
        tier: 'adult_optional',
        preferenceKey: 'adultOptional',
        eligibility: 'verified-adults',
      },
    };
  });

  const batch = {
    format: 'aetheria-lexicon-materials',
    schemaVersion: 2,
    source: {
      producer: raw.source?.producer || 'ai-nsfw',
      model: raw.source?.model || 'unknown',
      theme: `v1→v2 draft · ${raw.batchId} · 待审定 · 未实装`,
    },
    dictionary: { id: dictionary.id, version: dictionary.version, hash: dictionary.hash },
    domain: 'nsfw',
    library: raw.library,
    batchId: raw.batchId,
    entries,
  };

  const notes = {
    sourceFormat: 'aetheria-nsfw-lexicon-batch',
    sourceSchemaVersion: 1,
    batchId: raw.batchId,
    mappedAt: new Date().toISOString(),
    status: 'pending-review',
    runtime: 'not-installed',
    droppedFreeTags: raw.entries.map((e, i) => ({
      id: entries[i].id,
      name: e.name,
      v1Tags: e.tags || [],
      usage: e.usage || null,
    })),
    note: 'tags[] 为空：v1 中文自由标签不是运行字典 ID。审定后再挂 foundation:* 或编辑概念。',
  };

  return { batch, notes };
}

const registry = await dictionaryRegistry(root);
const pack = registry.packs.find((p) => p.id === 'aetheria/foundation');
if (!pack) throw Error('找不到 aetheria/foundation');
const dictionary = { id: pack.id, version: pack.version, hash: pack.hash };

await mkdir(outDir, { recursive: true });
const files = (await readdir(srcDir))
  .filter((f) => f.endsWith('.json') && f.startsWith('nsfw-'))
  .filter((f) => !filter || f.includes(filter))
  .sort();

if (!files.length) throw Error(`未找到匹配批次：${filter || '*'}`);

const summary = [];
for (const f of files) {
  const { batch, notes } = await mapBatch(path.join(srcDir, f), dictionary);
  validateSemanticBatch(batch, registry);
  const outJson = path.join(outDir, f.replace(/\.json$/, '.v2.json'));
  const outNotes = path.join(outDir, f.replace(/\.json$/, '.tag-notes.json'));
  await writeFile(outJson, JSON.stringify(batch, null, 2) + '\n');
  await writeFile(outNotes, JSON.stringify(notes, null, 2) + '\n');
  summary.push({ batchId: batch.batchId, entries: batch.entries.length, file: path.relative(root, outJson) });
  console.log(`mapped+validated ${batch.batchId} (${batch.entries.length}) → ${path.relative(root, outJson)}`);
}

await writeFile(
  path.join(outDir, 'MANIFEST.json'),
  JSON.stringify(
    {
      generatedBy: 'scripts/lexicon/map-nsfw-v1-to-v2.mjs',
      dictionary,
      filter: filter || null,
      status: 'pending-review',
      runtime: 'not-installed',
      batches: summary,
    },
    null,
    2,
  ) + '\n',
);
console.log(`done: ${summary.length} batches → ${path.relative(root, outDir)}`);
