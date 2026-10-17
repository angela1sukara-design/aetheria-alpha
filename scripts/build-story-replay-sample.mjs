import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadPacks } from '../src/content/loader.ts';
import { WorldGenerator } from '../src/world/generator.ts';
import { ActionExecutor } from '../src/engine/executor.ts';
import { SaveCodec } from '../src/persistence/codec.ts';
import { effectivePart } from '../src/engine/query.ts';

const json = async file => JSON.parse(await readFile(file, 'utf8'));
const index = await json('content/index.json');
const registry = await loadPacks(await Promise.all(index.packs.map(p => json('content/' + p))));
const rules = await json('content/generation/rules.json');
const reference = await json('content/generation/reference.json');
const out = path.resolve('artifacts/story-replay-sample');
await mkdir(out, { recursive: true });
const act = (engine, suffix) => {
  const result = engine.performAction({ actionId: 'stories:action.mire-trap.' + suffix }, engine.snapshot().meta.revision, 'sample-' + suffix);
  assert.equal(result.ok, true, result.message);
};
const active = engine => engine.snapshot().eventInstances.find(e => e.status === 'active');
const coating = (engine, r) => {
  const body = engine.snapshot().player.body;
  return effectivePart(body.parts.find(p => r.bodyPart(p.definitionId).kind === 'leg'), r).materialId;
};

function prepare(world, stamina) {
  // QA preparation only: a real generated location and explicit starting resources.
  // Once the executor exists, every story transition uses its normal transaction.
  const state = structuredClone(world.state);
  const location = world.world.definition.locations.find(l => l.service === 'commons');
  state.world.locationId = location.id;
  state.world.knownLocationIds = [...new Set([...state.world.knownLocationIds, location.id])];
  state.player.variables['core:stamina'] = stamina;
  state.player.variables['core:energy'] = 0;
  const engine = new ActionExecutor(world.registry, state);
  if (!engine.view().actions.some(a => a.available && a.definition.id === 'stories:action.mire-trap.start')) return null;
  act(engine, 'start');
  return engine;
}

// Select real results, without altering rule weights, material pools or RNG state.
const worlds = new Map();
for (let seed = 1; seed <= 32 && worlds.size < 2; seed++) {
  const world = await new WorldGenerator().generate({ seed, registry, rules, references: [reference] });
  const engine = prepare(world, 0);
  if (!engine) continue;
  const material = active(engine).context.fills.materialKey;
  if (!['M4', 'M5'].includes(material) || worlds.has(material)) continue;
  worlds.set(material, { seed, world });
}
assert.equal(worlds.size, 2, 'Expected both real slime and latex results within the documented seed search.');

const offline = await readFile('启动游戏-双击直接运行.html', 'utf8');
assert.ok(offline.includes('aetheriaInitialSave'), 'Build the current standalone game before preparing samples.');
const variants = [
  { key: 'strong', title: 'A · 体力充足', material: 'M4', stamina: 70 },
  { key: 'tired-slime', title: 'B · 体力耗尽 / 黏液', material: 'M4', stamina: 0 },
  { key: 'tired-latex', title: 'C · 体力耗尽 / 黑胶', material: 'M5', stamina: 0 },
];
const samples = [];
for (const variant of variants) {
  const { seed, world } = worlds.get(variant.material);
  const engine = prepare(world, variant.stamina);
  const initial = engine.snapshot();
  const codec = new SaveCodec(world.registry);
  const save = await codec.encode(initial);
  const loaded = await codec.decode(save);
  assert.equal(loaded.status, 'ready');
  assert.deepEqual(loaded.state, initial);
  const restored = new ActionExecutor(loaded.registry ?? world.registry, loaded.state);
  assert.deepEqual(restored.view(), engine.view());
  assert.equal(initial.district.profile.adultOptional, false);
  const binding = active(engine).context;
  const initialScene = engine.view().sceneText;
  assert.doesNotMatch(initialScene, /\{[a-zA-Z]+\}/);
  assert.equal(engine.view().actions.find(a => a.definition.id.endsWith('.pull')).available, variant.stamina >= 40);
  const time = initial.clock.totalMinutes;
  let expected;
  if (variant.stamina > 0) {
    act(engine, 'pull');
    assert.equal(engine.snapshot().player.variables['core:stamina'], 55);
    act(engine, 'leave');
    assert.equal(engine.snapshot().clock.totalMinutes - time, 10);
    assert.equal(engine.snapshot().player.flags['progression:flag.aftermath.mark'], false);
    expected = '拔出双腿耗时10分钟、体力70→55；离开后无此次覆层或受困残迹。';
  } else {
    act(engine, 'sink'); act(engine, 'endure');
    const materialId = variant.material === 'M5' ? 'progression:material.living-latex' : 'progression:material.slime-mucus';
    assert.equal(coating(engine, world.registry), materialId);
    const normal = new ActionExecutor(world.registry, engine.snapshot());
    act(normal, 'withdraw'); act(engine, 'skip');
    for (const key of ['clock', 'player', 'rng', 'eventInstances', 'tfQueues']) assert.deepEqual(engine.snapshot()[key], normal.snapshot()[key]);
    assert.equal(active(engine).nodeId, 'edge');
    assert.equal(engine.snapshot().clock.totalMinutes - time, 20);
    const leave = new ActionExecutor(world.registry, engine.snapshot());
    act(leave, 'leave');
    assert.equal(coating(leave, world.registry), materialId);
    assert.equal(leave.snapshot().player.flags['progression:flag.aftermath.mark'], true);
    act(engine, 'clean');
    assert.notEqual(coating(engine, world.registry), materialId);
    assert.equal(engine.snapshot().clock.totalMinutes - time, 30);
    assert.equal(engine.snapshot().player.flags['progression:flag.aftermath.mark'], false);
    assert.equal((await codec.decode(await codec.encode(engine.snapshot()))).status, 'ready');
    expected = '下沉5分钟＋受困10分钟＋撤离5分钟＝20分钟，保留实际覆层和残迹；清理另需10分钟并移除。跳过在清理/保留选择前停下。';
  }
  const fingerprint = createHash('sha256').update(save).digest('hex');
  const prefix = `<script>globalThis.aetheriaInitialSave=${JSON.stringify(save).replaceAll('<', '\\u003c')};globalThis.aetheriaSaveSlot=${JSON.stringify('story-acceptance-' + variant.key + '-' + fingerprint.slice(0, 12))};</script>`;
  const html = offline.replace(/<title>[^<]*<\/title>/, `<title>黑沼小样 ${variant.title}</title>`).replace('<head>', '<head>' + prefix);
  await writeFile(path.join(out, variant.key + '.html'), html);
  await writeFile(path.join(out, variant.key + '.json'), save);
  samples.push({ ...variant, seed, file: variant.key + '.html', save: variant.key + '.json', binding, initialScene, expected, fingerprint });
}
const manifest = { generatedAt: new Date().toISOString(), source: 'current content/index.json + generated world snapshots + current standalone game', preparation: '在真实生成地点准备体力与精力，正常提交事件入口后保存；不修改选敌规则或材质池。', samples, assertions: '真实绑定、属性门槛、实际覆层、清理/保留、跳过等价、存档恢复均通过；浏览器检查另记。' };
await writeFile(path.join(out, 'samples.json'), JSON.stringify(manifest, null, 2) + '\n');
await writeFile(path.join(out, 'README.md'), `# 黑沼陷阱：先验收这一条\n\n三个文件都是正常游戏，打开后点封面“进入”即到故事选择处。验收存档已准备地点和资源；正式存档槽不参与。\n\n${samples.map(s => `- [${s.title}](${s.file})：种子 ${s.seed}，${s.binding.fills.place}，${s.binding.fills.opponent}。${s.expected}`).join('\n')}\n\nA/B 使用同一世界、同一对手和材质，只有体力不同。C 是另一份真实生成世界；两种材质由实际选敌产生。完整段落和适用分支已经编写，系统按数据选用，不代表无限自由写作。\n\n低资源路线：护住身体下沉 → 护住呼吸承受围困 → 正常撤离或略过撤离描写 → 自选清理或带着现状离开。留意覆层、残迹和时间；没有自动心性变化，也没有凭跳过回到安全点。\n\n如已手动保存，重开会继续该小样进度。重测时从游戏存档页导入旁边同名 JSON；也可以用新浏览器会话打开。导入小样会替换当前会话，请在这三个独立小样页面内操作。\n\n正文节奏、选择是否有意义和后续扩展仍待人工验收。技术记录见 [samples.json](samples.json) 和浏览器检查结果。\n`);
console.log(JSON.stringify(samples.map(({ title, seed, binding }) => ({ title, seed, place: binding.fills.place, opponent: binding.fills.opponent, material: binding.fills.materialKey })), null, 2));
