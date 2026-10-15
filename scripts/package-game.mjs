import { readdir, readFile, writeFile, mkdir, lstat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { deflateRawSync, inflateRawSync } from 'node:zlib';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'deliverables/game/Aetheria-Game-and-Tags-2026-10-14.zip');
const reportDirectory = path.join(root, 'artifacts/game-package');
const files = new Map();
const excluded = [];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
async function add(relative) {
  const absolute = path.resolve(root, relative);
  if (!absolute.startsWith(root)) throw Error(`Outside project: ${relative}`);
  const info = await lstat(absolute);
  if (info.isSymbolicLink()) throw Error(`Linked file: ${relative}`);
  if (info.isDirectory()) {
    for (const entry of (await readdir(absolute)).sort()) await add(`${relative}/${entry}`);
    return;
  }
  if (relative.startsWith('production/') && (
    /\.(zip|gz|tar|bundle)$/i.test(relative) ||
    /^production\/lexicon-authoring\/(tasks|prompts|examples|inbox|outbox)\//.test(relative) ||
    /(^|\/)(ACCEPTANCE|WHOLE-PACK-ACCEPTANCE)\.md$/.test(relative) ||
    relative.endsWith('/verify.test.mjs')
  )) { excluded.push(relative); return; }
  files.set(relative, await readFile(absolute));
}
for (const dir of ['src', 'content', 'production', 'docs/tag-hub', 'dist/src', 'dist/content', 'scripts/nsfw-auto-combo']) await add(dir);
for (const name of ['index.html', 'tsconfig.json', 'start_game.bat', '.gitignore', 'dist/index.html', 'dist/Aetheria-Folio.html', 'ai.md', 'docs/ai-collaboration-review.md', 'docs/entity-functions-batch.md', 'docs/module-d-implementation.md', 'docs/module-d-collaboration-review.md']) await add(name);
for (const name of ['build-adventure-content', 'build-personality-content', 'build-lexicon-adapter', 'build-neighborhood-quests', 'build-quest-content', 'build-standalone', 'build-world-profiles', 'build-world-samples', 'build', 'serve']) await add(`scripts/${name}.mjs`);
for (const name of ['catalog', 'cli', 'inventory', 'library', 'neighborhood', 'prepare', 'semantic-format', 'whole-pack']) await add(`scripts/lexicon/${name}.mjs`);
for (const name of ['foundation-v0.4', 'foundation-tag-mapping', 'general-vocabulary-expansion-v2', 'general-vocabulary-rule-plan', 'content-tag-story-standard', 'nsfw-auto-combo', 'adventure-framework-2026-10-13']) await add(`docs/${name}.md`);

const packageInfo = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
packageInfo.scripts = Object.fromEntries(Object.entries(packageInfo.scripts).filter(([name]) => ['dev', 'build', 'quests:build', 'lexicon', 'lexicon:prepare', 'lexicon:build', 'typecheck'].includes(name)));
packageInfo.devDependencies = { typescript: packageInfo.devDependencies.typescript };
const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'));
lock.packages = { '': { ...lock.packages[''], devDependencies: packageInfo.devDependencies }, 'node_modules/typescript': lock.packages['node_modules/typescript'] };
files.set('package.json', Buffer.from(JSON.stringify(packageInfo, null, 2) + '\n'));
files.set('package-lock.json', Buffer.from(JSON.stringify(lock, null, 2) + '\n'));
files.set('README.md', Buffer.from(`# 以太都市：游戏工程与全部 Tag 资料\n\n## 直接游玩\n\n解压后打开 \`dist/Aetheria-Folio.html\`，不需要安装依赖。需要本地网页方式时，安装 Node.js 24 或以上，再双击 \`start_game.bat\`。\n\n## 修改和构建\n\n当前游戏源码在 \`src/\`，内容在 \`content/\`。首次开发执行 \`npm ci\` 安装锁定的 TypeScript 依赖，再执行 \`npm run build\`。不包含浏览器测试依赖和旧工程。\n\n## 未实装的 Tag\n\n见 [Tag 资料索引](TAG-资料索引.md)。原始条目、外部候选、NSFW 批次、v2 草案、审稿与用途账本均保留原路径和原字节；没有把候选自动标为已实装。\n\n## 精简范围\n\n不包含 Git 历史、node_modules、旧交付压缩包、历史归档、测试脚本、截图日志、故事参考原稿，以及可由 \`npm run lexicon:prepare\` 重新生成的批次任务、提示词和示例。运行目录只带当前游戏，不带旧兼容 HTML 或预生成世界示例。制作目录中不同版本的数据保留，用于来源核对和后续实装。\n\n包内 package.json 仅保留随包提供的命令，依赖锁定仅保留构建所需的 TypeScript；游戏源码和 Tag 数据未改写。\n\n## 验证与现有问题\n\n打包时逐文件记录 SHA-256，所有压缩条目均读回核对。PACKAGE-MANIFEST.json 列出实际文件和精简规则。多 AI 协作方案与已核对的修订口径见 ai.md 及 docs/ai-collaboration-review.md；C 已完成首批 NPC 服务与地点设施，D 已实装；A/B/E 与 C 剩余内容仍待实施。构建与游玩检查结果另记录在原工程 artifacts/game-package。\n`, 'utf8'));
files.set('TAG-资料索引.md', Buffer.from(`# Tag 资料索引\n\n| 路径 | 内容与状态 |\n| --- | --- |\n| content/foundation/、content/general-lexicon/、content/generation/ | 当前运行字典、已安装内容及生成参考 |\n| production/lexicon-authoring/collections/ | 基础词库原始收录批次，含尚未审定或使用的条目 |\n| production/lexicon-authoring/management/ | 收录索引、领取信息、审稿状态与实际用途账本 |\n| production/lexicon-authoring/adapters/、formats/ | 已审定候选接入配置与交换格式、规则说明 |\n| production/tag-deliveries/2026-10-12/ | 外部原文、待入库候选、整理版、扩充版与第二轮 v2 数据；各版本保留来源关系 |\n| docs/tag-hub/nsfw-batches/ | NSFW 原始机读批次与 v2-draft 草案 |\n| docs/tag-hub/rules/、outbox/、inventory/ | 共存互斥规则、故事试写、候选清单与来源索引 |\n| production/TAG-STORY-WRITING-SPEC.md | Tag 与组合故事制作要求 |\n\n收录、审定、实装是不同状态，按数据中的状态字段和用途账本判断。目录和条目未因打包自动注册到游戏。\n\n旧 ZIP、tar.gz 不重复携带，其已解包的条目及可读正文保留。部分原始 README 或收据仍引用旧压缩包、历史分支及测试，这些用于追溯；包内使用方式以根目录 README 为准。\n\n制作模板未携带，若要继续派发新批次，可先运行 npm run lexicon:prepare 重建模板；收录批次、审稿和用途数据均已保留。\n`, 'utf8'));

const tagPaths = [...files.keys()].filter(p => p.startsWith('production/lexicon-authoring/') || p.startsWith('production/tag-deliveries/') || p.startsWith('docs/tag-hub/'));
const manifest = { format: 'aetheria-game-and-tags-package', date: '2026-10-14', runtimeEntry: 'dist/Aetheria-Folio.html', tagSourceFiles: tagPaths.length, excludedHistoricalOrRegenerableFiles: excluded, excludedDirectories: ['.git', 'node_modules', 'archive', 'artifacts', 'deliverables', 'tests', 'docs/故事'], packageOnlyEdits: ['README.md', 'TAG-资料索引.md', 'package.json', 'package-lock.json'], files: [...files].map(([name, bytes]) => ({ path: name, bytes: bytes.length, sha256: sha(bytes) })) };
files.set('PACKAGE-MANIFEST.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
for (const required of ['src/ui/main.ts', 'dist/Aetheria-Folio.html', 'production/lexicon-authoring/management/reviews.json', 'production/tag-deliveries/2026-10-12/general-expansion-v2/entries.jsonl']) if (!files.has(required)) throw Error(`Missing ${required}`);
for (const name of files.keys()) if (/^(archive|artifacts|deliverables|node_modules|tests|\.git)\//.test(name)) throw Error(`Unwanted entry ${name}`);

// Standard ZIP with UTF-8 names, DEFLATE and CRC-32; no staging copy of the project.
const table = Array.from({ length: 256 }, (_, n) => { for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
function crc32(bytes) { let crc = 0xffffffff; for (const b of bytes) crc = table[(crc ^ b) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }
const locals = [], central = []; let offset = 0; const verified = [];
for (const [name, bytes] of [...files].sort(([a], [b]) => a.localeCompare(b))) {
  const encoded = Buffer.from(name), compressed = deflateRawSync(bytes), crc = crc32(bytes);
  const header = Buffer.alloc(30); header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x800, 6); header.writeUInt16LE(8, 8); header.writeUInt16LE(0x5d4e, 12); header.writeUInt32LE(crc, 14); header.writeUInt32LE(compressed.length, 18); header.writeUInt32LE(bytes.length, 22); header.writeUInt16LE(encoded.length, 26);
  const record = Buffer.alloc(46); record.writeUInt32LE(0x02014b50); record.writeUInt16LE(20, 4); header.copy(record, 6, 4, 30); record.writeUInt32LE(offset, 42);
  locals.push(header, encoded, compressed); central.push(record, encoded); offset += header.length + encoded.length + compressed.length;
  verified.push({ name, offset: offset - compressed.length, compressedBytes: compressed.length, sha256: sha(bytes), crc });
}
const directory = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.size, 8); end.writeUInt16LE(files.size, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
await mkdir(path.dirname(output), { recursive: true });
try { await writeFile(output, Buffer.concat([...locals, directory, end]), { flag: 'wx' }); }
catch (e) { if (e.code === 'EEXIST') throw Error('Package already exists; refusing to overwrite.'); throw e; }
const archive = await readFile(output);
for (const file of verified) { const bytes = inflateRawSync(archive.subarray(file.offset, file.offset + file.compressedBytes)); if (sha(bytes) !== file.sha256 || crc32(bytes) !== file.crc) throw Error(`ZIP mismatch: ${file.name}`); }
await mkdir(reportDirectory, { recursive: true });
await writeFile(path.join(reportDirectory, 'verification.json'), JSON.stringify({ archive: output, archiveBytes: archive.length, archiveSha256: sha(archive), files: files.size, tagSourceFiles: tagPaths.length, allFileHashesAndCrcVerified: true, validation: 'ZIP generated and verified; independent extraction/build verification pending' }, null, 2));
console.log(JSON.stringify({ archive: output, files: files.size, tagSourceFiles: tagPaths.length, MB: Number((archive.length / 1024 ** 2).toFixed(2)), sha256: sha(archive) }, null, 2));
