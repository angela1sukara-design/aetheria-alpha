import type{ContentPack}from'../core/types.ts';
export function isAppendOnlyEventPack(p:ContentPack):boolean {
 return !p.start&&!['variables','flags','hooks','locations','routes','bodyParts','bodyTemplates','bodyPatches','transformations','species','npcs','npcMemories','storylets','residentTemplates','enemies','interactions','textSlots','sceneTexts','equipment','globalActionHooks','tags','materials','morphologies','partProfiles','npcBodies','locationProfiles','residentAdaptations','derivedTags','proseMaterials','proseSelections','narrativeProfiles','narrativeNodes','environmentEnemyRules'].some(key=>((p as unknown as Record<string,unknown[]>)[key]?.length??0)>0);
}
