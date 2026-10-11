// One-time additive integration of the Alpha 0.2 module; retained for audit.
import { readFile, writeFile } from 'node:fs/promises';
async function edit(path, fn) { const s = await readFile(path,'utf8'); await writeFile(path,fn(s)); }
const kinds = "'storylets', 'residentTemplates', 'enemies', 'interactions', 'textSlots', 'sceneTexts', 'equipment'";
await edit('src/content/registry.ts', s => s
 .replace("import { RuleError }", "import type { StoryletDef, ResidentTemplate, EnemyDef, InteractionDef, TextSlotDef, SceneTextDef, EquipmentDef } from '../core/district-types.ts';\nimport { RuleError }")
 .replace('  constructor(packs:', `  readonly storylets: StoryletDef[]; readonly residentTemplates: ResidentTemplate[];
  readonly enemies: EnemyDef[]; readonly interactions: InteractionDef[]; readonly textSlots: TextSlotDef[];
  readonly sceneTexts: SceneTextDef[]; readonly equipment: EquipmentDef[];
  constructor(packs:`)
 .replace('    for (const pack of data)', `    this.storylets = freeze(data.flatMap(x => x.storylets ?? []).sort((a,b) => a.id.localeCompare(b.id,'en')));
    this.residentTemplates = freeze(data.flatMap(x => x.residentTemplates ?? []));
    this.enemies = freeze(data.flatMap(x => x.enemies ?? []));
    this.interactions = freeze(data.flatMap(x => x.interactions ?? []));
    this.textSlots = freeze(data.flatMap(x => x.textSlots ?? []));
    this.sceneTexts = freeze(data.flatMap(x => x.sceneTexts ?? []));
    this.equipment = freeze(data.flatMap(x => x.equipment ?? []));
    for (const pack of data)`)
 .replace("'npcs', 'npcMemories'] as const", `'npcs', 'npcMemories', ${kinds}] as const`));
await edit('src/content/schema.ts', s => s
 .replace("'npc.fixed.v1'] as const", "'npc.fixed.v1', 'district.v1'] as const")
 .replace("'npcs', 'npcMemories']);", `'npcs', 'npcMemories', ${kinds}]);`)
 .replace("    else fail(`${path}/op`, '未知或未实现的条件", `    else if (op === 'day.after') { const x = obj(value,path,['op','flagId','days']); id(x.flagId,path); integer(x.days,path,1,30); }
    else if (op === 'scene.state') { const x = obj(value,path,['op','value']); choice(x.value,path,['active','paused','none']); }
    else if (op === 'resident.available') obj(value,path,['op']);
    else if (op === 'player.created') { const x = obj(value,path,['op','value']); boolean(x.value,path); }
    else fail(\x60\x24{path}/op\x60, '未知或未实现的条件`)
 .replace("    else fail(`${path}/op`, '未知或未实现的效果", `    else if (['world.encounter','resident.talk','resident.help','equipment.remove'].includes(String(op))) obj(value,path,['op']);
    else if (['combat.start','scene.start','equipment.wear'].includes(String(op))) { const x = obj(value,path,['op','id']); id(x.id,path); }
    else if (op === 'combat.turn') { const x = obj(value,path,['op','move']); choice(x.move,path,['attack','guard','recover','flee']); }
    else if (op === 'scene.act') { const x = obj(value,path,['op','move','poseId']); choice(x.move,path,['pose','contact','release','pause','resume','exit']); if(x.poseId !== undefined) str(x.poseId,path); }
    else if (op === 'player.create') { const x = obj(value,path,['op','name','ageYears']); str(x.name,path); integer(x.ageYears,path,18,120); }
    else if (op === 'preference.set') { const x = obj(value,path,['op','value']); boolean(x.value,path); }
    else fail(\x60\x24{path}/op\x60, '未知或未实现的效果`)
 .replace('  if (issues.length) throw new PackError(issues);', `  parseDistrict(input, { obj, str, id, integer, boolean, list, choice, condition });
  if (issues.length) throw new PackError(issues);`)
 .replace("import { PART_KINDS", "import { parseDistrict } from './district-schema.ts';\nimport { PART_KINDS"));
await edit('src/content/loader.ts', s => s
 .replace("'npcs', 'npcMemories'] as const", `'npcs', 'npcMemories', ${kinds}] as const`)
 .replace("    else if (c.op === 'flag.has')", "    else if (c.op === 'day.after') ref(p,c.flagId,'flags',path);\n    else if (c.op === 'flag.has')")
 .replace("    else if (e.op === 'flag.set')", "    else if (e.op === 'combat.start') ref(p,e.id,'enemies',path);\n    else if (e.op === 'scene.start') ref(p,e.id,'interactions',path);\n    else if (e.op === 'equipment.wear') ref(p,e.id,'equipment',path);\n    else if (e.op === 'flag.set')")
 .replace('  const registry = new Registry(sorted, references);','  const registry = new Registry(sorted, references);\n  validateDistrictDefinitions(sorted, registry, fail, checkCondition);')
 .replace("import { PackError }", "import { validateDistrictDefinitions } from './district-schema.ts';\nimport { PackError }"));
await edit('src/engine/state.ts',s=>s.replace("import type { GameState }", "import { initialDistrict } from './district.ts';\nimport type { GameState }").replace('  return {','  return {\n    ...(registry.storylets.length ? { district: initialDistrict() } : {}),'));
await edit('src/engine/conditions.ts',s=>s.replace("    case 'all':",`    case 'day.after': { const at = state.district?.factsAt[condition.flagId]; pass = at !== undefined && Math.floor(state.clock.totalMinutes / 1440) >= Math.floor(at / 1440) + condition.days; reason = '需要等到下一个约定的游戏日。'; break; }
    case 'scene.state': pass = (state.district?.scene?.phase ?? 'none') === condition.value; break;
    case 'resident.available': pass = !!state.district?.residents.some(r => r.id === state.district?.currentResidentId && r.locationId === state.world.locationId); break;
    case 'player.created': pass = (state.district?.profile.created ?? false) === condition.value; break;
    case 'all':`));
await edit('src/engine/effects.ts',s=>s
 .replace("import { npcPresent", "import { encounter, residentInteraction } from './district.ts';\nimport { applyDistrictEffect } from './district-effects.ts';\nimport { npcPresent")
 .replace("        if (before !== effect.value)", "        if (effect.value && draft.district && draft.district.factsAt[effect.id] === undefined) draft.district.factsAt[effect.id] = draft.clock.totalMinutes;\n        if (before !== effect.value)")
 .replace("      case 'var.change':", `      case 'world.encounter': { const id = encounter(draft,registry); if(id) applyEffects([{op:'event.start',id}],draft,registry,context); else context.resolvedTexts.push('街区暂时平静。你留意了周围的人与路况。'); break; }
      case 'resident.talk': case 'resident.help': context.resolvedTexts.push(residentInteraction(draft,registry,effect.op === 'resident.help')); break;
      case 'combat.start': case 'combat.turn': case 'scene.start': case 'scene.act': case 'equipment.wear': case 'equipment.remove': case 'player.create': case 'preference.set':
        applyDistrictEffect(effect,draft,registry,context,applyEffects); break;
      case 'var.change':`));
await edit('src/engine/selectors.ts',s=>s
 .replace("import { directResourceCheck", "import { districtOptions, districtText } from './district-effects.ts';\nimport { directResourceCheck")
 .replace('  return allActions.map(definition => {','  return districtOptions(state,registry,allActions).map(definition => {')
 .replace("sceneText: current ? registry.text(current.event.textByNode[current.node.id]) : registry.text(location.textKey),", "sceneText: districtText(state,registry,current ? registry.text(current.event.textByNode[current.node.id]) : registry.text(location.textKey)),"));
