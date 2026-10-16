import type { GameState } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import { environment, effectivePart } from './query.ts';

/** Read actual saved entities; rendering never invents an NPC, organ or location. */
export function sceneContext(state: GameState, registry: Registry): Record<string,string> {
  const place = registry.location(state.world.locationId);
  const present = state.district?.residents.filter(n=>n.locationId===place.id)??[];
  const person = present.find(n=>n.id===state.district?.currentResidentId)??present[0];
  const minute = state.clock.totalMinutes%1440;
  const routes = registry.routes.filter(r=>r.from===place.id).map(r=>registry.location(r.to).name);
  const parts = state.player.body?.parts.map(p=>({part:p,definition:registry.bodyPart(p.definitionId)}))??[];
  const distinct = [...new Set([...parts].sort((a,b)=>Number(['tail','ear','wing'].includes(b.definition.kind))-Number(['tail','ear','wing'].includes(a.definition.kind))).map(({part,definition})=>{
    const actual=effectivePart(part,registry);
    const cleanLabel=definition.label==='人类耳'?'双耳':definition.label.replace(/^人类(?=.{2,})/,'');return cleanLabel+(part.overrides?.materialId?`（${registry.material(actual.materialId!).label}）`:'')+(part.overrides?.lengthMm?`，${actual.lengthMm}毫米`:'');
  }))];
  const jobs = state.tfQueues.filter(j=>(!j.target||j.target.kind==='player')&&['active','paused','blocked'].includes(j.status));
  const job = jobs[0];
  const statuses = {active:'正在推进',paused:'已暂停',blocked:'等待处理',completed:'已完成',cancelled:'已停止'};
  const service = environment(state,registry).service;
  return {
    place:place.name, player:state.district?.profile.name??'旅人',
    period:minute<360?'深夜':minute<720?'上午':minute<1080?'午后':minute<1320?'傍晚':'夜里',
    nearby:person?`${person.name}（${person.profession}）此刻就在这里。${person.personality.replace(/[。！？]$/,'')}。`:'此刻没有居民在这里停留。你可以自行活动，或等候他们按日程到来。',
    routeNames:routes.join('、')||'当前地点',
    bodyState:distinct.slice(0,4).join('、')||'当前身体',
    tfState:job?`${registry.transformation(job.definitionId).label}${statuses[job.status]}，已进行${job.elapsedMinutes}分钟。`:'目前没有等待推进的身体变化。',
    localWork:service.known?({home:'收拾公共空间',market:'整理摊位',workshop:'整理工具',clinic:'整理护理用品',commons:'清理通道'} as Record<string,string>)[service.value]??'整理公共空间':'整理公共空间',
  };
}
