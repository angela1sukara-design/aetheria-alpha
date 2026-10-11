import { clone, freeze } from '../core/types.ts';
import type { ActionDef, ContentPack, EventDef, FlagDef, HookDef, Id, LocationDef, PackRef, RouteDef, VariableDef } from '../core/types.ts';
import type { BodyPartDef, BodyTemplateDef, BodyPatchDef, TFDef } from '../core/body-types.ts';
import type { NPCDef, NPCMemoryDef, SpeciesDef } from '../core/npc-types.ts';
import type { StoryletDef, ResidentTemplate, EnemyDef, InteractionDef, TextSlotDef, SceneTextDef, EquipmentDef } from '../core/district-types.ts';
import { RuleError } from '../core/errors.ts';
export class Registry {
  #definitions = new Map<string, { kind: string; value: unknown }>();
  #actionsByHook = new Map<Id, Id[]>();
  readonly packs: PackRef[];
  readonly start: { locationId: Id; minutes: number };
  readonly variables: VariableDef[];
  readonly flags: FlagDef[];
  readonly locations: LocationDef[];
  readonly routes: RouteDef[];
  readonly bodyTemplates: BodyTemplateDef[];
  readonly transformations: TFDef[];
  readonly globalActionHooks: Id[];
  readonly npcs: NPCDef[];
  readonly npcMemories: NPCMemoryDef[];
  readonly legacyRegistry?: Registry;
  readonly storylets: StoryletDef[]; readonly residentTemplates: ResidentTemplate[];
  readonly enemies: EnemyDef[]; readonly interactions: InteractionDef[]; readonly textSlots: TextSlotDef[];
  readonly sceneTexts: SceneTextDef[]; readonly equipment: EquipmentDef[];
  constructor(packs: ContentPack[], references: PackRef[]) {
    // 私有 Map 永远不暴露；深冻结所有定义，避免 UI/扩展包直接改注册表。
    const data = freeze(clone(packs));
    if (packs.some(p => p.manifest.requiresCapabilities.includes('district.v1'))) {
      const legacy = packs.filter(p => !p.manifest.requiresCapabilities.includes('district.v1'));
      this.legacyRegistry = new Registry(legacy, references.filter(ref => legacy.some(p => p.manifest.id === ref.id)));
    }
    this.packs = freeze(clone(references));
    this.start = freeze(data.find(x => x.start)!.start!);
    this.variables = freeze(data.flatMap(x => x.variables)); this.flags = freeze(data.flatMap(x => x.flags));
    this.locations = freeze(data.flatMap(x => x.locations)); this.routes = freeze(data.flatMap(x => x.routes));
    this.bodyTemplates = freeze(data.flatMap(x => x.bodyTemplates ?? []));
    this.transformations = freeze(data.flatMap(x => x.transformations ?? []));
    this.globalActionHooks = freeze(data.flatMap(x => x.globalActionHooks ?? []).sort());
    this.npcs = freeze(data.flatMap(x => x.npcs ?? []).sort((a, b) => a.id.localeCompare(b.id, 'en')));
    this.npcMemories = freeze(data.flatMap(x => x.npcMemories ?? []));
    this.storylets = freeze(data.flatMap(x => x.storylets ?? []).sort((a,b) => a.id.localeCompare(b.id,'en')));
    this.residentTemplates = freeze(data.flatMap(x => x.residentTemplates ?? []));
    this.enemies = freeze(data.flatMap(x => x.enemies ?? []));
    this.interactions = freeze(data.flatMap(x => x.interactions ?? []));
    this.textSlots = freeze(data.flatMap(x => x.textSlots ?? []));
    this.sceneTexts = freeze(data.flatMap(x => x.sceneTexts ?? []));
    this.equipment = freeze(data.flatMap(x => x.equipment ?? []));
    for (const pack of data) {
      for (const kind of ['variables', 'flags', 'hooks', 'locations', 'routes', 'actions', 'events', 'bodyParts', 'bodyTemplates', 'bodyPatches', 'transformations', 'species', 'npcs', 'npcMemories', 'storylets', 'residentTemplates', 'enemies', 'interactions', 'textSlots', 'sceneTexts', 'equipment'] as const) for (const def of pack[kind] ?? []) this.#definitions.set(def.id, { kind, value: def });
      for (const [key, text] of Object.entries(pack.texts)) this.#definitions.set(key, { kind: 'texts', value: text });
      for (const c of pack.contributions) this.#actionsByHook.set(c.hookId, [...(this.#actionsByHook.get(c.hookId) ?? []), ...c.actionIds]);
    }
    for (const [key, values] of this.#actionsByHook) this.#actionsByHook.set(key, [...new Set(values)].sort());
    Object.freeze(this);
  }
  private get<T>(id: Id, kind: string): T {
    const entry = this.#definitions.get(id);
    if (!entry || entry.kind !== kind) throw new RuleError('UNKNOWN_DEFINITION', `${id} 不是已注册的 ${kind}。`);
    return entry.value as T;
  }
  variable(id: Id): VariableDef { return this.get(id, 'variables'); }
  flag(id: Id): FlagDef { return this.get(id, 'flags'); }
  hook(id: Id): HookDef { return this.get(id, 'hooks'); }
  location(id: Id): LocationDef { return this.get(id, 'locations'); }
  route(id: Id): RouteDef { return this.get(id, 'routes'); }
  action(id: Id): ActionDef { return this.get(id, 'actions'); }
  event(id: Id): EventDef { return this.get(id, 'events'); }
  bodyPart(id: Id): BodyPartDef { return this.get(id, 'bodyParts'); }
  bodyTemplate(id: Id): BodyTemplateDef { return this.get(id, 'bodyTemplates'); }
  bodyPatch(id: Id): BodyPatchDef { return this.get(id, 'bodyPatches'); }
  transformation(id: Id): TFDef { return this.get(id, 'transformations'); }
  npc(id: Id): NPCDef { return this.get(id, 'npcs'); }
  npcMemory(id: Id): NPCMemoryDef { return this.get(id, 'npcMemories'); }
  species(id: Id): SpeciesDef { return this.get(id, 'species'); }
  actionsForHook(id: Id): ActionDef[] { this.hook(id); return (this.#actionsByHook.get(id) ?? []).map(x => this.action(x)); }
  globalActions(): ActionDef[] { return this.globalActionHooks.flatMap(h => (this.#actionsByHook.get(h) ?? []).map(x => this.action(x))); }
  text(id: Id): string { return this.get(id, 'texts'); }
  actionsAt(id: Id): ActionDef[] { return (this.#actionsByHook.get(this.location(id).actionHook) ?? []).map(x => this.action(x)); }
}
