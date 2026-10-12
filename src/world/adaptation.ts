import type { Registry } from '../content/registry.ts';
import type { BodyGraph } from '../core/body-types.ts';
import type { ResidentTemplate } from '../core/district-types.ts';
import { bodyTraits } from '../engine/body.ts';
/** 旧包采用明确的 v1 劳动约定。新包可声明职业能力及辅助移动，不强迫所有居民有手有脚。 */
export function residentAdaptation(t:ResidentTemplate,r:Registry){
  return r.residentAdaptations.find(a=>a.templateId===t.id)??{workCapabilities:['grasp'] as const,mobility:'walk' as const};
}
export function activityEligibility(body:BodyGraph,t:ResidentTemplate,r:Registry):{pass:boolean;reason:string}{
  const rule=residentAdaptation(t,r),traits=bodyTraits(body,r);
  const pass=rule.workCapabilities.every(c=>traits[c]>0)&&(rule.mobility==='assisted'||traits.walk>0);
  return {pass,reason:pass?'':'当前身体不符合已声明的职业活动或移动适配。'};
}
