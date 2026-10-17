import type { FoundationDefinitions, PartAttributes, TagDef } from '../core/query-types.ts';
import { clone, freeze } from '../core/types.ts';
import type { ActionDef, ContentPack, EventDef, FlagDef, HookDef, Id, LocationDef, PackRef, RouteDef, VariableDef } from '../core/types.ts';
import type { BodyPartDef, BodyTemplateDef, BodyPatchDef, TFDef } from '../core/body-types.ts';
import type { NPCDef, NPCMemoryDef, SpeciesDef } from '../core/npc-types.ts';
import type { StoryletDef, ResidentTemplate, EnemyDef, InteractionDef, TextSlotDef, SceneTextDef, EquipmentDef, ItemDef } from '../core/district-types.ts';
import { RuleError } from '../core/errors.ts';
import { isAppendOnlyEventPack } from './append-only.ts';
import type { DefeatReactionRule, EnvironmentEnemyRule, NarrativeNode, NarrativeProfile } from '../core/adventure-types.ts';
export class Registry {
  readonly contentPacks: ContentPack[];
  readonly narrativeNodes: NarrativeNode[];
  readonly narrativeProfiles: NarrativeProfile[];
  readonly environmentEnemyRules: EnvironmentEnemyRule[];
  readonly defeatReactionRules: DefeatReactionRule[];
  #definitions = new Map<string, { kind: string; value: unknown; packId:string }>();
  #actionsByHook = new Map<Id, Id[]>();
  #tagById = new Map<Id, TagDef>();
  #tagByAlias = new Map<string, Id[]>();
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
  readonly appendOnlyPackIds: string[];
  readonly storylets: StoryletDef[]; readonly residentTemplates: ResidentTemplate[];
  readonly enemies: EnemyDef[]; readonly interactions: InteractionDef[]; readonly textSlots: TextSlotDef[];
  readonly sceneTexts: SceneTextDef[]; readonly equipment: EquipmentDef[]; readonly items: ItemDef[];
  readonly proseMaterials: NonNullable<FoundationDefinitions['proseMaterials']>;
  readonly proseSelections: NonNullable<FoundationDefinitions['proseSelections']>;
  readonly tags: TagDef[];
  readonly derivedTags: NonNullable<FoundationDefinitions['derivedTags']>;
  readonly locationProfiles: NonNullable<FoundationDefinitions['locationProfiles']>;
  readonly npcBodies: NonNullable<FoundationDefinitions['npcBodies']>;
  readonly residentAdaptations: NonNullable<FoundationDefinitions['residentAdaptations']>;
  readonly tagReferences: Readonly<Record<string, {packId:string;version:string;pointer:string}[]>>;
  constructor(packs: ContentPack[], references: PackRef[]) {
    // 私有 Map 永远不暴露；深冻结所有定义，避免 UI/扩展包直接改注册表。
    const data = freeze(clone(packs));
    this.contentPacks = data;
    this.narrativeNodes = freeze(data.flatMap(p=>p.narrativeNodes??[]));
    this.narrativeProfiles = freeze(data.flatMap(p=>p.narrativeProfiles??[]));
    this.environmentEnemyRules = freeze(data.flatMap(p=>p.environmentEnemyRules??[]));
    this.defeatReactionRules = freeze(data.flatMap(p=>p.defeatReactionRules??[]));
    this.appendOnlyPackIds = freeze(data.filter(isAppendOnlyEventPack).map(p=>p.manifest.id));
    if (packs.some(p => p.manifest.requiresCapabilities.includes('district.v1'))) {
      const legacy = packs.filter(p => !p.manifest.requiresCapabilities.includes('district.v1') && p.manifest.schemaVersion!==2);
      this.legacyRegistry = new Registry(legacy, references.filter(ref => legacy.some(p => p.manifest.id === ref.id)));
    }
    this.proseMaterials=freeze(data.flatMap(p=>p.proseMaterials??[]));
    this.proseSelections=freeze(data.flatMap(p=>p.proseSelections??[]));
    this.tags=freeze(data.flatMap(p=>p.tags??[]));
    for (const t of this.tags) {
      this.#tagById.set(t.id, t);
      for (const a of t.aliases) {
        const key = `${a.scope}/${a.value}`;
        const list = this.#tagByAlias.get(key) ?? [];
        if (!list.includes(t.id)) list.push(t.id);
        this.#tagByAlias.set(key, list);
      }
    }
    this.derivedTags=freeze(data.flatMap(p=>p.derivedTags??[]));
    this.locationProfiles=freeze(data.flatMap(p=>p.locationProfiles??[]));
    this.npcBodies=freeze(data.flatMap(p=>p.npcBodies??[]));
    this.residentAdaptations=freeze(data.flatMap(p=>p.residentAdaptations??[]));
    const refs:Record<string,{packId:string;version:string;pointer:string}[]>={};
    for(const pack of data){const scan=(v:unknown,path:string)=>{if(Array.isArray(v))v.forEach((x,i)=>scan(x,path+'/'+i));else if(v&&typeof v==='object')Object.entries(v).forEach(([k,x])=>{if(k!=='tags'||path!=='')scan(x,path+'/'+k);});else if(typeof v==='string'&&(/\/(tags|requiresTags|excludesTags|compatibleTags|environmentTags)\/\d+$|\/tag(Id)?$/.test(path))){const direct=this.#tagById.get(v as Id);const viaAlias=path.startsWith('/storylets/')?this.#tagByAlias.get(`story.v1/${v}`)?.[0]:undefined;const tagId=direct?.id??viaAlias;if(tagId)(refs[tagId]??=[]).push({packId:pack.manifest.id,version:pack.manifest.version,pointer:path});}};scan(pack,'');}
    this.tagReferences=freeze(refs);
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
    this.items = freeze(data.flatMap(x => x.items ?? []));
    for (const pack of data) {
      for (const kind of ['variables', 'flags', 'hooks', 'locations', 'routes', 'actions', 'events', 'bodyParts', 'bodyTemplates', 'bodyPatches', 'transformations', 'species', 'npcs', 'npcMemories', 'storylets', 'residentTemplates', 'enemies', 'interactions', 'textSlots', 'sceneTexts', 'equipment', 'items', 'tags', 'materials', 'morphologies', 'partProfiles', 'npcBodies', 'locationProfiles', 'residentAdaptations', 'derivedTags', 'proseMaterials', 'proseSelections'] as const) for (const def of pack[kind] ?? []) this.#definitions.set(def.id, { kind, value: def,packId:pack.manifest.id });
      for (const [key, text] of Object.entries(pack.texts)) this.#definitions.set(key, { kind: 'texts', value: text,packId:pack.manifest.id });
      for (const kind of ['narrativeNodes','narrativeProfiles','environmentEnemyRules','defeatReactionRules'] as const) for (const value of pack[kind]??[]) this.#definitions.set(value.id,{kind,value,packId:pack.manifest.id});
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
  hasTag(id: string): boolean { return this.#tagById.has(id as Id); }
  resolveTagIds(value: string, scope: TagDef['aliases'][number]['scope']): Id[] {
    const out: Id[] = [];
    if (this.#tagById.has(value as Id)) out.push(value as Id);
    for (const id of this.#tagByAlias.get(`${scope}/${value}`) ?? []) if (!out.includes(id)) out.push(id);
    return out;
  }
  provenance(id:Id):PackRef{const entry=this.#definitions.get(id);if(!entry)throw new RuleError('UNKNOWN_DEFINITION','内容定义不存在。');return this.packs.find(p=>p.id===entry.packId)!;}
  tag(id:Id):TagDef{return this.get(id,'tags');}
  material(id:Id):NonNullable<FoundationDefinitions['materials']>[number]{return this.get(id,'materials');}
  morphology(id:Id):NonNullable<FoundationDefinitions['morphologies']>[number]{return this.get(id,'morphologies');}
  partDefaults(id:Id):PartAttributes {return {...this.bodyPart(id).defaults,...this.contentPacks.flatMap(p=>p.partProfiles??[]).find(p=>p.partId===id)?.defaults};}
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
