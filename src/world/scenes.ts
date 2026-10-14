import type { ContentPack, Effect, Id } from '../core/types.ts';
import type { NarrativeChoice, NarrativeKind } from '../core/adventure-types.ts';
import type { Registry } from '../content/registry.ts';
import type { WorldDef } from './types.ts';
import { proseProblem } from '../content/player-prose.ts';

/** Compile the sampled local content, routes and economy into playable scenes.
 * These definitions are saved with the generated world, just like its map and NPCs.
 */
export function compileWorldScenes(pack: ContentPack, world: WorldDef, source: Registry): void {
  if (!source.narrativeNodes.length) return;
  if (!pack.manifest.requiresCapabilities.includes('adventure.v1')) pack.manifest.requiresCapabilities.push('adventure.v1');
  const key = (s: string): Id => `worldgen:${s}`;
  const checked = (body: string) => {
    const problem = proseProblem(body, true);
    if (problem) throw Error(`生成场景失败：${problem}。`);
    return body;
  };
  const choice = (name: string, label: string, body: string, effects: Effect[], conditions: NarrativeChoice['conditions'] = []): NarrativeChoice => {
    const textKey = key(`text.scene.choice.${name}`); pack.texts[textKey] = checked(body);
    return {label, resultText: textKey, effects, conditions, next: null, setTags: [], unsetTags: []};
  };
  const allowedTag = (tagId: string): tagId is Id => {
    if (pack.tags?.some(t => t.id === tagId && t.status === 'active')) return true;
    if (!source.hasTag(tagId)) return false;
    const def = source.tag(tagId as Id);
    if (def.status !== 'active') return false;
    const prov = source.provenance(tagId as Id);
    return prov.id === pack.manifest.id || pack.manifest.dependencies.some(d => d.id === prov.id);
  };
  const node = (name: string, kind: NarrativeKind, title: string, body: string, locationId: Id, choices: NarrativeChoice[], conditions: NarrativeChoice['conditions'] = [], maxVisits = 3, tendencies: { tagId: Id; weight: number }[] = []) => {
    const textKey = key(`text.scene.${name}`); pack.texts[textKey] = checked(body);
    (pack.narrativeNodes ??= []).push({id: key(`node.scene.${name}`), kind, stage:'start', title, textKey,
      conditions:[{op:'location.is',id:locationId},...conditions], requiresTags:[],
      excludesTags:source.hasTag('progression:tag.nsfwcombo.active')?[{role:'opponent',tagId:'progression:tag.nsfwcombo.active'}]:[],
      tendencies, weight:10, priority:20, maxVisits, choices:[...choices,choice(name+'.leave','返回地点','你回到{place}，继续自己的安排。',[])]});
  };
  for (const [index, place] of world.locations.entries()) {
    const location = pack.locations.find(l=>l.id===place.id)!;
    const faction = world.factions.find(f=>f.id===place.factionId)!;
    const work = pack.actions.find(a=>a.id===key(`action.work.${index}`))!;
    const activities = pack.actions.filter(a=>a.id.startsWith(key(`action.activity.${index}.`)));
    const canWork=location.facilities===undefined||location.facilities.includes('workplace');
    const routes = pack.routes.filter(r=>r.from===place.id);
    const placeTendencies = [...new Set([`foundation:service.${place.service}`, ...place.tags])]
      .filter(allowedTag)
      .slice(0, 6)
      .map(tagId => ({ tagId, weight: 2 }));
    const routeChoices = routes.slice(0,2).map((r,i)=>{
      const destination = pack.locations.find(l=>l.id===r.to)!;
      return choice(`${index}.route.${i}`,`沿通道前往${destination.name}`,`你循着路标抵达${destination.name}。`,[{op:'location.move',routeId:r.id}]);
    });
    const activityChoice = (a: typeof work, suffix: string) => choice(`${index}.${suffix}`,a.label,pack.texts[a.resultText]!,a.effects,a.conditions);
    const local = location.facilities===undefined?`${location.name}的${place.economy.join('、')}由${faction.name}协调。`:pack.texts[location.textKey]!;
    node(`${index}.explore`,'exploration',`探索${location.name}`,
      `{period}，你来到{place}的通道旁。${local}\n\n{nearby}\n\n路牌通向${routes.map(r=>pack.locations.find(l=>l.id===r.to)!.name).join('、')}。`,
      place.id,[...routeChoices,...(canWork?[activityChoice(work,'explore.work')]:[])], [], 3, placeTendencies);
    const rest = pack.actions.find(a=>a.id===key(`action.rest.${index}`))!;
    node(`${index}.daily`,'daily',`${location.name}的一段日常`,
      `{period}，${local}\n\n{nearby}`,place.id,
      [...(activities[0]||canWork?[activityChoice(activities[0]??work,'daily.work')]:[]),activityChoice(rest,'daily.rest')], [], 3, placeTendencies);
    const storylets = pack.storylets!.filter(s=>s.locationId===place.id && s.eventId.startsWith('worldgen:')&&!s.eventId.startsWith('worldgen:event.danger.'));
    for (const [j, storylet] of storylets.entries()) {
      const event = pack.events.find(e=>e.id===storylet.eventId)!;
      const start = event.nodes.find(n=>n.id===event.startNode)!;
      const finish = pack.actions.find(a=>a.id===start.actionIds[0])!;
      const flag = key(`flag.scene.${index}.${j}`); pack.flags.push({id:flag,initial:false});
      // Both the ordinary world event and the narrative route complete the same job.
      finish.effects.unshift({op:'flag.set',id:flag,value:true});
      const effects = finish.effects.filter(e=>e.op!=='event.advance');
      node(`${index}.encounter.${j}`,'encounter',`${location.name} · ${finish.label}`,
        `{period}，{place}的${place.economy[0]}正要开始。${faction.name}留出了一块交接的位置。\n\n${pack.texts[start.textVariants[0]!]!}\n\n{nearby}`,
        place.id,[choice(`${index}.encounter.${j}.finish`,finish.label,pack.texts[finish.resultText]!,effects,finish.conditions),
          choice(`${index}.encounter.${j}.meet`,'先认识在场的人','你走向留在{place}的人，准备听听对方的近况。',[{op:'world.encounter',events:false}])],
        [{op:'flag.has',id:flag,value:false}], 1, placeTendencies);
    }
    // When every local job is done, offer actual social/travel choices, not an empty shell.
    node(`${index}.encounter.quiet`,'encounter',`${location.name}的片刻`,
      `{period}，${local}\n\n{nearby}\n\n你可以认识在场的人，或者沿通道前往下一处。`,place.id,
      [choice(`${index}.quiet.meet`,'看看此刻在场的人','你在{place}停步，与在场的人打招呼。',[{op:'world.encounter',events:false}]),...routeChoices.slice(0,1)],
      storylets.map((_,j)=>({op:'flag.has',id:key(`flag.scene.${index}.${j}`),value:true})), 3, placeTendencies);
  }
}
