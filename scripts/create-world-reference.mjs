// 可重复生成首版结构化示例；运行游戏只读取 JSON，不调用本脚本或 AI。
import { mkdir, writeFile } from 'node:fs/promises';
const rules = { format: 'aetheria-generation-rules', schemaVersion: 1, id: 'aetheria/neighborhood-rules', version: '0.1.0', requiredServices: ['home', 'market', 'workshop', 'clinic', 'commons'], locationCount: 7, npcCount: 9, extraConnections: 3, startMinutes: 540, workStart: 480, workEnd: 1080, leisureEnd: 1320 };
const defaults = { environmentTags: [], weight: 10, requiresTags: [], excludesTags: [], compatibleTags: [], requiresPacks: ['aetheria/district'], combination: { requiresTemplates: [], excludesTemplates: [], boosts: [] }, contributes: { tags: [], npcTemplateIds: [], eventIds: [], tfIds: [] } };
const template = (id, kind, data, options = {}) => ({ ...structuredClone(defaults), id, kind, data, ...options });
const templates = [];
for (const [key, name, description, tags] of [
  ['wet', '雾潮街区', '潮雾绕着高架水槽流动，蕨叶从砖缝探出来。人们按雨势安排工作。', ['climate.wet', 'ecology.fern', 'waterways']],
  ['dry', '晴砾街区', '日光照亮挡风棚，旱生灌木沿石墙生长。居民把重活放在阴凉时段。', ['climate.dry', 'ecology.shrub', 'solar']],
]) {
  templates.push(template(`base.environment.${key}`, 'environment', { name, description, tags }));
  const places = key === 'wet' ? [
    ['home', ['滴檐合住院', '苔阶公寓'], '共用厨房飘着热汤气味。合住院保留了免费休息座位。', ['公共厨房轮值', '住宅维护'], ['夜班信使']],
    ['market', ['浮棚食集', '水槽交易巷'], '防雨棚下交换食物、修理材料与准确的送货时间。', ['食物分拣', '日用品交易'], ['摊贩']],
    ['workshop', ['水泵维修所', '铜叶工坊'], '泵件按接口大小摆开，工具架让不同身体的工人都够得到。', ['水泵维护', '工具修理'], ['维护电工']],
    ['clinic', ['雾灯护理站', '蕨廊适配室'], '护理站提供身体适配、恢复座位和公开的改装流程。', ['适配器消毒', '身体护理'], ['夜班信使']],
    ['commons', ['雨声公共厅', '渠畔信使站'], '交接板记录可公开的消息。夜班信使在此核对路标。', ['路线核对', '公共信息交接'], ['夜班信使']],
  ] : [
    ['home', ['遮阳共享院', '石阶住舍'], '厚墙隔开正午热气，公共长凳向每个旅人开放。', ['遮阳棚轮值', '住宅维护'], ['夜班信使']],
    ['market', ['晴棚干货市', '风井商街'], '粮袋和密封容器整齐排开，摊贩反复核对防尘封口。', ['干货分装', '日用品交易'], ['摊贩']],
    ['workshop', ['镜板维修坊', '风井电工铺'], '反光板为室内引光，维护电工在阴影下测试接头。', ['镜板检修', '线路维护'], ['维护电工']],
    ['clinic', ['凉荫适配室', '晴石护理站'], '通风的走廊留着恢复座位，护理员按登记流程接受改装预约。', ['护理用品分装', '身体适配'], ['夜班信使']],
    ['commons', ['风影交接厅', '石墙信使所'], '人们把路牌移到阴凉处，再把准确的去向写在公共板上。', ['公共路标维护', '邮件交接'], ['夜班信使']],
  ];
  for (const [service, names, description, economy, professions] of places) {
    const contributes = structuredClone(defaults.contributes);
    contributes.tags = [`service.${service}`];
    if (service === 'clinic') contributes.tfIds = ['aetheria-tf:tf.tail.mechanical'];
    templates.push(template(`base.place.${key}.${service}`, 'place', { service, names, description, economy, professions }, { environmentTags: [`climate.${key}`], contributes }));
  }
  for (const [suffix, label, activities] of [['care', key === 'wet' ? '潮汐互助会' : '凉荫互助会', ['恢复座位维护', '照护轮值']], ['trade', key === 'wet' ? '水槽工联' : '镜板工联', ['工具共享', '工单交接']]]) templates.push(template(`base.faction.${key}.${suffix}`, 'faction', { name: label, activities }, { environmentTags: [`climate.${key}`] }));
  templates.push(template(`base.event.${key}`, 'event', key === 'wet' ? { label: '一起检查防雨棚扣', prompt: '当班人发现雨棚扣有些松动，问你是否愿意花一小段时间核对编号。也可以先离开。', completeText: '你核对了扣件并把实际情况写进交接册。值班人按约定付了报酬。', minutes: 15, reward: 3 } : { label: '帮助标记遮阳时段', prompt: '公共板上的遮阳时间被风沙磨淡。当班人想请你核对阴影边界，也尊重你今天另有安排。', completeText: '你按实际观察补全了遮阳时段。居民能据此安排搬运，当班人结清报酬。', minutes: 20, reward: 4 }, { environmentTags: [`climate.${key}`] }));
}
for (const key of ['vendor', 'electrician', 'courier']) templates.push(template(`base.npc.${key}`, 'npc', { residentTemplateId: `district:resident.${key}` }));
const reference = { format: 'aetheria-reference', schemaVersion: 1, id: 'aetheria/neighborhood-reference', version: '0.1.0', templates };
const addonContent = { manifest: { id: 'example/lamplighters', namespace: 'lamplighter', version: '1.0.0', schemaVersion: 1, engineApiVersion: '0.1', author: 'PROPOSED generation example', status: 'reviewed', dependencies: [{ id: 'aetheria/reshaping', version: '0.1.0', optional: false }, { id: 'aetheria/social', version: '0.1.0', optional: false }], requiresCapabilities: ['body.graph.v1', 'npc.fixed.v1', 'district.v1'], migrations: [] }, variables: [], flags: [], hooks: [], locations: [], routes: [], actions: [], events: [], texts: {}, contributions: [], species: [{ id: 'lamplighter:species.citizen', label: '灯匠社群成员', intelligent: true, adultAgeYears: 18 }], residentTemplates: [{ id: 'lamplighter:resident.artisan', locationIds: ['aetheria:location.street'], start: 480, end: 1080, names: ['陶灯', '苏焰'], profession: '灯匠', appearance: ['工具袋装着透明灯罩'], personality: ['耐心，重视交接'], behavior: 'repair', speciesId: 'lamplighter:species.citizen', ageYears: 32, bodyTemplateId: 'aetheria-tf:body.human', patchIds: ['aetheria-tf:patch.ears.cat'] }] };
const addonReference = { format: 'aetheria-reference', schemaVersion: 1, id: 'example/lamplighter-reference', version: '1.0.0', templates: [template('addon.place.lamps', 'place', { service: 'workshop', names: ['灯罩修配所'], description: '灯匠测试公共灯的散热和防雨性能，接受实际修理工单。', economy: ['灯罩检修'], professions: ['灯匠', '维护电工'] }, { requiresPacks: ['example/lamplighters'], weight: 1000 }), template('addon.npc.artisan', 'npc', { residentTemplateId: 'lamplighter:resident.artisan' }, { requiresPacks: ['example/lamplighters'], weight: 1000 })] };
await mkdir('content/generation', { recursive: true });
for (const [name, value] of [['rules', rules], ['reference', reference], ['addon-content', addonContent], ['addon-reference', addonReference]]) await writeFile(`content/generation/${name}.json`, JSON.stringify(value, null, 2) + '\n');
console.log('Structured reference, rules and optional content examples written.');
