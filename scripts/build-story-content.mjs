import { readFile, writeFile, mkdir } from 'node:fs/promises';

// Author complete paragraphs and ordinary actions. No lexicon or A/B generator.
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const index = await json('content/index.json');
const sources = await Promise.all(index.packs.filter(path => !path.includes('/story-replay/')).map(path => json('content/' + path)));
const id = value => `stories:${value}`;
const pack = {
  manifest: { id: 'aetheria/story-replay', namespace: 'stories', version: '1.0.0', schemaVersion: 2, engineApiVersion: '0.1', author: 'Aetheria', status: 'draft', dependencies: sources.map(p => ({ id: p.manifest.id, version: p.manifest.version, optional: false })), requiresCapabilities: ['foundation.v2', 'condition.v1', 'effect.v1', 'event.choice.v1', 'event.context.v1', 'hook.global.v1', 'adventure.v1', 'district.v1', 'body.graph.v1', 'tf.pipeline.v1'], migrations: [] },
  variables: [], flags: [], hooks: [{ id: id('hook.entries'), accepts: 'action', visibility: 'public' }], locations: [], routes: [], actions: [], events: [], texts: {}, contributions: [], globalActionHooks: [id('hook.entries')], transformations: [],
  environmentEnemyRules: [
    { id: id('env.wet-slime'), enemyId: 'district:enemy.gel', requiresTags: ['foundation:setting.wet', 'foundation:service.commons'], priority: 11, weight: 1, name: '湿地黏液群落', speciesKind: 'slime', defeatCombo: { autoCombo: true, materials: ['M4'], parts: ['小腿'], plays: ['G1', 'G2'], tfs: ['黏液化'] } },
    { id: id('env.wet-latex'), enemyId: 'district:enemy.gel', requiresTags: ['foundation:setting.wet', 'foundation:service.commons'], priority: 11, weight: 1, name: '湿地黑胶群落', speciesKind: 'slime', defeatCombo: { autoCombo: true, materials: ['M5'], parts: ['小腿'], plays: ['G1', 'G2'], tfs: ['黑胶化'] } },
    { id: id('env.wet-workshop'), enemyId: 'district:enemy.scavenger', requiresTags: ['foundation:setting.wet', 'foundation:service.workshop'], priority: 5, weight: 1, name: '失控搬运装置', speciesKind: 'construct' },
  ],
};
const text = (key, body) => { const keyId = id('text.' + key); pack.texts[keyId] = body; return keyId; };
const flag = name => { const flagId = id('flag.' + name); pack.flags.push({ id: flagId, initial: false }); return flagId; };
const advance = nodeId => ({ op: 'event.advance', nodeId });
const time = minutes => ({ op: 'clock.advance', minutes });
const resource = (key, amount) => ({ op: 'var.change', id: 'core:' + key, amount });
const atLeast = (key, value) => ({ op: 'var.compare', id: 'core:' + key, comparison: 'gte', value });
const marked = value => ({ op: 'flag.set', id: 'progression:flag.aftermath.mark', value });
const material = materialId => ({ op: 'body.matches', target: { kind: 'player' }, part: { kind: 'leg', materialId } });
const coated = { op: 'any', conditions: [material('progression:material.slime-mucus'), material('progression:material.living-latex')] };
const matchMaterial = keys => ({ op: 'any', conditions: keys.map(materialKey => ({ op: 'opponent.matches', materialKey })) });

function story(name, label, binding, hint) {
  const event = { id: id('event.' + name), startNode: 'entry', binding, rating: 'general', nodes: [] };
  pack.events.push(event);
  const startId = id('action.' + name + '.start');
  pack.actions.push({ id: startId, label, hint, group: 'explore', conditions: [{ op: 'event.state', id: event.id, state: 'unseen' }], effects: [{ op: 'event.start', id: event.id }], resultText: text(name + '.start', '你接手了眼前正在发生的事情。') });
  pack.contributions.push({ hookId: id('hook.entries'), actionIds: [startId] });
  return {
    event,
    node(nodeId, body, options = {}) { const node = { id: nodeId, type: 'choice', textVariants: [text(name + '.' + nodeId, body)], actionIds: [], onEnter: [], ...options }; event.nodes.push(node); return node; },
    action(node, suffix, label, effects, result, conditions = [], hint = '继续处理眼前的处境') {
      const actionId = id('action.' + name + '.' + suffix);
      pack.actions.push({ id: actionId, label, hint, group: 'event', conditions, effects, resultText: text(name + '.result.' + suffix, result), context: { eventId: event.id, nodeId: node.id } });
      node.actionIds.push(actionId); return actionId;
    },
    variant(node, suffix, when, body, effects = []) { (node.textCases ??= []).push({ when, text: text(name + '.' + node.id + '.' + suffix, body), onEnter: effects }); },
  };
}

// Immediate story settlement reuses the existing coating patches and cleanser.
// The existing progression:tf.slime-coating remains a timed, optional process.
for (const [key, patch] of [['slime', 'slime-legs'], ['latex', 'latex-legs']]) pack.transformations.push({
  id: id('tf.' + key + '-legs'), label: key === 'slime' ? '陷阱留下的下肢黏液覆层' : '陷阱留下的下肢黑胶覆层', source: 'free',
  stages: [{ id: 'settle', label: '体表覆层结算', atMinutes: 0, patchId: 'progression:patch.' + patch }],
});

const mire = story('mire-trap', '穿过湿地边缘的狭窄通道', { environmentTags: ['foundation:setting.wet', 'foundation:service.commons'], enemy: 'environment', partKind: 'leg' }, '湿地险路 · 可能发生交锋与体表覆层');
const entry = mire.node('entry', '你沿{place}的湿地边缘踏上狭窄通道，脚下浮泥突然向内塌陷，冷水夹着软泥漫过{part}。你抓住身旁突出的支点，泥面另一侧的{opponent}却已循着水声靠近。支点正在松动，你必须在发力脱身、另找落脚处和迎击来敌之间立即作出选择。', { combatOutcomes: { victory: 'edge', defeat: 'defeat', escape: 'edge' } });
mire.variant(entry, 'tired', [atLeast('stamina', 0), { op: 'var.compare', id: 'core:stamina', comparison: 'lte', value: 39 }], '你走进{place}边缘的低洼通道，浮泥在脚下突然塌陷，冷水很快浸过{part}。你试着提起身体，疲乏的双腿却撑不住整块泥面的吸力；水声又引来了{opponent}，它正从通道另一头逼近。身旁还有一处支点，你得决定借力横移、迎击，还是先护住身体承受下陷。');
mire.action(entry, 'pull', '趁泥层未合拢拔出双腿', [resource('stamina', -15), time(10), advance('edge')], '你借支点发力拔出双腿，退到了坚实的路沿。', [atLeast('stamina', 40)], '体力≥40 · 体力−15 · 10分钟');
mire.action(entry, 'climb', '借支点攀援横移', [resource('energy', -15), time(5), advance('edge')], '你判断支点间的距离，沿通道侧面攀回了实地。', [atLeast('energy', 35), { op: 'body.hasCapability', capability: 'grasp', count: 1 }], '精力≥35 · 需要抓握部位 · 精力−15 · 5分钟');
mire.action(entry, 'fight', '撑住支点迎击{opponent}', [{ op: 'combat.encounter' }], '你稳住身形，迎向逼近的对手。', [], '进入常规战斗；结果返回当前故事');
mire.action(entry, 'sink', '护住身体，随泥面下沉寻找落脚处', [time(5), advance('trapped')], '你护住口鼻停止乱蹬，浮泥继续下陷，脚下终于碰到一段倾斜的硬面。');
const trapped = mire.node('trapped', '你在{place}下陷的通道里踩住一段硬面，泥水仍围在腰侧，身后的{opponent}已经截住来路。你把重心压在尚未塌掉的边缘，能感觉到支点正缓缓滑开。此时硬挣还有机会翻上路沿；若撑不住，就得护住呼吸，承受这次受困留下的后果。');
mire.action(trapped, 'break-free', '借最后的支点强行翻上路沿', [resource('stamina', -25), time(10), advance('edge')], '你猛力蹬住硬面，翻过了正在塌落的路沿。', [atLeast('stamina', 55)], '体力≥55 · 体力−25 · 10分钟');
mire.action(trapped, 'endure', '护住呼吸，承受围困', [time(10), advance('defeat')], '你没能脱身，只能稳住呼吸，等待压制松动。');
const defeat = mire.node('defeat', '你在{place}的低处耗尽了脱身的机会，{opponent}压住来路，直到泥面停止塌落才渐渐松开。你扶着路沿重新站稳，衣物上留着清楚的擦痕与残迹，刚才受困的经过也已留下记录。眼前通道终于空出一线，你得带着本次实际留下的状态撤回路沿。', { onEnter: [marked(true)] });
for (const [key, keys, materialId, body] of [
  ['latex', ['M5'], 'progression:material.living-latex', '你在{place}的低处被{opponent}截住退路，紧贴{part}的{material}随拉扯收束，最终在下肢留下富有弹性的体表覆层。你没有再贸然发力，直到周围的压制渐渐松动，才撑着路沿站稳。覆层和本次受困的记录都已保留，现在只能先带着这些后果撤回通道。'],
  ['slime', ['M1', 'M2', 'M3', 'M4', 'M6'], 'progression:material.slime-mucus', '你在{place}的低处被{opponent}截住来路，{material}顺着{part}延展，在下肢留下湿滑的生物黏液覆层。你护住呼吸等到浮泥稳住，才抓着路沿缓缓站起，体表的附着感仍然清楚。本次覆层与受困记录已经落定，你得先带着它们撤回可以站稳的通道。'],
]) {
  mire.variant(defeat, key + '.existing', [matchMaterial(keys), material(materialId)], body);
  mire.variant(defeat, key + '.settle', [matchMaterial(keys), { op: 'tf.available', id: id('tf.' + key + '-legs') }], body, [{ op: 'tf.apply', id: id('tf.' + key + '-legs') }]);
}
const settlement = [time(5), advance('edge')];
mire.action(defeat, 'withdraw', '扶住路沿，带着残迹撤离', settlement, '你等到通道空出，带着体表状态与受困记录撤回了路沿。', [], '等待压制松动，再退回可以站稳的位置');
defeat.skipActionId = mire.action(defeat, 'skip', '略过撤离描写', settlement, '你略过撤离过程的描写，耗时和已有后果照常保留。', [], '仍需5分钟，已有体表状态和残迹保留');
const edge = mire.node('edge', '你退到了{place}坚实的路沿，身后的泥面渐渐恢复平静，{opponent}也没有继续逼近。你终于能重新掌握脚下的重心，但衣物和体表是否留有覆层，仍要按刚才实际发生的结果处理。前方道路已经畅通，你可以花时间清理后再走，也可以带着现状离开这段险路。');
mire.action(edge, 'clean', '花时间清理附着物后离开', [time(10), advance('clean-end')], '你停下清理衣物和体表，再沿当前道路离开险处。', [], '停留10分钟，清理衣物和已有覆层');
mire.action(edge, 'leave', '带着现状离开险路', [advance('end')], '你沿当前地点的道路离开险处，已有的身体状态继续保留。');
const cleanEnd = mire.node('clean-end', '你清理了衣物上的残迹，重新走上{place}可以正常通行的道路。', { type: 'exit', onEnter: [marked(false), { op: 'event.exit' }] });
mire.variant(cleanEnd, 'coated', [coated], '你调用清理方法洗去实际存在的下肢覆层，沿{place}的道路继续行动。', [{ op: 'tf.apply', id: 'progression:tf.cleanse-coatings' }]);
mire.node('end', '你沿{place}的道路离开了塌陷处。已经结算的体表状态与受困记录继续保留，之后可以自行清理或处理。', { type: 'exit', onEnter: [{ op: 'event.exit' }] });

const cargoLost = flag('cargo-lost'), cargoSaved = flag('cargo-saved'), leadFound = flag('false-order-found');
const alley = story('alley-handoff', '替在场的委托人交接货箱', { environmentTags: ['foundation:service.workshop'], resident: { tags: [], service: { subject: 'resident', service: 'work' } }, enemy: 'environment' }, '委托交接 · 可能丢失货物或发生交锋');
const handoff = alley.node('entry', '你替{resident}把密封货箱推到{place}后侧的交接通道，头顶的铁门却突然落下，堵住了原来的出口。{opponent}循着货箱的声响逼近，箱体正卡在侧门与墙沿之间。你看见侧门还留着一道缝，得立刻决定撞门带货脱身、留在原地迎战，还是弃货翻过旁边的矮墙。', { combatOutcomes: { victory: 'loot', defeat: 'loss', escape: 'loss' } });
alley.variant(handoff, 'construct', [{ op: 'opponent.matches', speciesKind: 'construct' }], '你替{resident}把密封货箱送到{place}后侧的交接通道，铁门突然落下，{opponent}的搬运臂也随之转向箱体。它没有按交接信号停机，金属轮履正在封住出口，侧门却还留着一道窄缝。你必须决定带货撞开侧门、迎战这台失控设备，或弃货翻过矮墙。');
alley.action(handoff, 'ram', '带着货箱撞开侧门', [resource('stamina', -15), time(10), { op: 'flag.set', id: cargoSaved, value: true }, advance('report')], '你撞开侧门，将货箱一起推回了公共通道。', [atLeast('stamina', 45)], '体力≥45 · 体力−15 · 10分钟');
alley.action(handoff, 'fight', '护住货箱迎战{opponent}', [{ op: 'combat.encounter' }], '你用货箱挡住第一下冲击，准备迎战。');
alley.action(handoff, 'abandon', '弃下货箱，等对方移开障碍', [time(10), advance('loss')], '你不再阻挡对方清运货箱，等到门口重新空出才离开；这次委托未能保住货物。', [], '等待10分钟 · 货箱丢失');
const loot = alley.node('loot', '你在{place}的交接通道里击退了{opponent}，落下的铁门旁只剩货箱和一张被踩皱的交接单。你检查封条，发现货物还完整，但对方使用的印记与{resident}交给你的原单并不一致。你现在可以带着证据回去追查，也可以只把货箱交还，先结清这次受托的账目。', { onEnter: [{ op: 'flag.set', id: cargoSaved, value: true }] });
alley.action(loot, 'evidence', '带回货箱与假交接单', [time(5), { op: 'flag.set', id: leadFound, value: true }, advance('report')], '你收好交接单，带着货箱返回委托人所在的通道。');
alley.action(loot, 'cargo-only', '只带货箱回去结账', [time(5), advance('report')], '你带回完整货箱，暂时搁下交接单上的疑点。');
const loss = alley.node('loss', '你从{place}的交接通道脱身时，货箱已经落在{opponent}封住的门后，无法再按原单完成交接。你稳住呼吸，确认自己能够继续行动，手中还攥着委托凭据。货物丢失已经成为事实，你得回到{resident}面前说明经过，再决定是否花力气追查这张可疑的单据。', { onEnter: [{ op: 'flag.set', id: cargoLost, value: true }, marked(true)] });
alley.action(loss, 'report-loss', '带着丢货的结果回去说明', [time(5), advance('report')], '你沿当前地点的通道返回，准备说明货物丢失的经过。');
const report = alley.node('report', '你回到{place}的交接处，找到仍在这里的{resident}，把手中的委托凭据放上工作台。刚才落门与拦截的经过让这笔交接显得格外可疑，货物的实际结果也已经记下。对方等着你说明下一步：是继续花精力核对这张单据，还是只按当前结果结清基础账目。');
alley.variant(report, 'lost', [{ op: 'flag.has', id: cargoLost, value: true }], '你回到{place}，把没有完成交接的凭据交给{resident}，如实说明货箱留在封门后的经过。工作台上还压着一份原始委托单，与交接处的印记明显对不上。丢货的结果不会因回报而抹去，你现在可以花精力追查假单据，也可以先结清这次受托的基础账目。');
alley.action(report, 'investigate', '说明经过，追查假单据', [resource('energy', -10), time(10), resource('money', 25), { op: 'flag.set', id: leadFound, value: true }, advance('end')], '你与{resident}核对了两份单据，记录下伪造线索，并结清了25零钱的调查报酬。货物的原有结果继续保留。', [atLeast('energy', 30)], '精力≥30 · 精力−10 · 10分钟 · 零钱+25');
alley.action(report, 'basic-pay', '按实际结果结清基础账目', [resource('money', 10), advance('end')], '你与{resident}结清了10零钱的基础报酬，交接结果与已有线索仍然保留。');
alley.node('end', '你结束了与{resident}的这次交接，继续沿{place}的通道行动。已经结算的报酬、货物结果和调查记录都保留在当前进度中。', { type: 'exit', onEnter: [{ op: 'event.exit' }] });

await mkdir('content/story-replay', { recursive: true });
await writeFile('content/story-replay/pack.json', JSON.stringify(pack, null, 2) + '\n');
console.log(`Story content: ${pack.events.length} stories, ${pack.actions.length} actions; complete prose, live entity bindings.`);
