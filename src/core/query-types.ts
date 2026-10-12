import type { Id, Condition } from './types.ts';
import type { PartKind, BodyCapability } from './body-types.ts';
/** 实体引用是路由，不保存或拥有身体副本。 */
export type EntityRef = { kind: 'player' } | { kind: 'npc'; id: Id } | { kind: 'resident'; id: string };
export type QueryResult<T> = { known: true; value: T } | { known: false; reason: string };
export interface PartAttributes { materialId?: Id; morphologyId?: Id; color?: 'black' | 'white' | 'grey' | 'brown' | 'silver'; lengthMm?: number }
export interface PartPredicate extends PartAttributes { kind?: PartKind; materialFamily?: 'organic' | 'mechanical'; instanceId?: string; minLengthMm?: number }
export interface TagDef { id: Id; label: string; definition: string; facets: ('setting' | 'ecology' | 'service' | 'body' | 'theme' | 'context' | 'retrieval')[]; status: 'active' | 'deprecated'; aliases: { scope: 'generation.v1' | 'story.v1' | 'lexicon.v2'; value: string }[]; replacementId?: Id }
export interface FoundationDefinitions {
  proseMaterials?: { id: Id; text: string; tags: Id[]; review: 'approved' | 'hold'; source: string; tier: 'general' }[];
  proseSelections?: { id: Id; entryId: Id; channel: 'body' | 'environment'; when: Condition[] }[];
  tags?: TagDef[];
  materials?: { id: Id; label: string; family: 'organic' | 'mechanical' }[];
  morphologies?: { id: Id; label: string; kinds: PartKind[] }[];
  /** 旧定义不改字节；唯一版本化扩展为其提供默认参数。禁止两个 profile 覆盖同一部件。 */
  partProfiles?: { id: Id; partId: Id; defaults: PartAttributes }[];
  npcBodies?: { id: Id; npcId: Id; bodyTemplateId: Id; patchIds: Id[] }[];
  locationProfiles?: { id: Id; locationId: Id; service?: 'home' | 'market' | 'workshop' | 'clinic' | 'commons'; light?: 'lit' | 'dark' }[];
  residentAdaptations?: { id: Id; templateId: Id; workCapabilities: BodyCapability[]; mobility: 'walk' | 'assisted' }[];
  derivedTags?: { id: Id; tagId: Id; subject: 'entity' | 'location' | 'world'; when: Condition }[];
}
export type QueryCondition =
  | { op: 'body.matches'; target: EntityRef; part: PartPredicate }
  | { op: 'environment.light'; locationId?: Id; value: 'lit' | 'dark' }
  | { op: 'environment.service'; locationId?: Id; value: 'home' | 'market' | 'workshop' | 'clinic' | 'commons' };
