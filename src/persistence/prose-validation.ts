import type {GameState} from '../core/types.ts';
import type {Registry} from '../content/registry.ts';
import {shape} from '../content/foundation-schema.ts';
import {proseProblem} from '../content/player-prose.ts';
import {validateLexeme} from '../engine/prose-assembly.generated.ts';
import {replayAProse} from '../engine/a-prose.ts';
import {entityKey} from '../engine/query.ts';
export function validateProseSnapshot(s:GameState,r:Registry):void{
 const story=s.adventure?.story;if(!story)return;
 const node=r.narrativeNodes.find(n=>n.id===story.nodeId)!;
 const p=story.prose;
 const bad=():never=>{throw Error('模板正文快照无效。');};
 if(!node.proseAssembly){if(p!==undefined)bad();return;}
 if(!p)throw Error('模板正文快照缺失。');
 shape(p,['version','nodeId','ruleId','mode','text','lexemes','context']);
 if(p.version!==1||p.nodeId!==node.id||p.ruleId!==node.proseAssembly.rule.id||!['assembled','fallback'].includes(p.mode)||typeof p.text!=='string'||p.text.length>10000||proseProblem(p.text))bad();
 if(!Array.isArray(p.lexemes)||p.lexemes.length>32||new Set(p.lexemes.map(e=>e.id)).size!==p.lexemes.length)bad();
 const c=p.context;shape(c,['seed','revision','bindings','facts','registeredTags','displayValues','exitChoice']);
 if(!Number.isSafeInteger(c.seed)||c.seed<0||c.seed>0xffffffff||!Number.isSafeInteger(c.revision)||c.revision<0||c.revision>s.meta.revision)bad();
 shape(c.bindings,[],['place','prop','sense','material','actor','part','exit']);
 for(const b of Object.values(c.bindings)){shape(b,['subject','instanceId']);if(typeof b.subject!=='string'||!b.subject||b.subject.length>300||typeof b.instanceId!=='string'||!b.instanceId||b.instanceId.length>300)bad();}
 const location=r.location(s.world.locationId);
 if(c.bindings.place?.instanceId!==location.id||c.bindings.place?.subject!=='location/'+location.id)bad();
 if(c.bindings.actor&&(!story.actor||c.bindings.actor.subject!==entityKey(story.actor)||c.bindings.actor.instanceId!==entityKey(story.actor)))bad();
 if(node.proseAssembly.mode==='body'&&story.actor?.kind!=='player')bad();
 shape(c.facts,[],['actor.present']);for(const f of Object.values(c.facts)){shape(f,['known','source','value']);if(f.known!==true||f.source!=='engine-query'||f.value!==true)bad();}
 if(!Array.isArray(c.registeredTags)||c.registeredTags.length||!Array.isArray(c.displayValues)||c.displayValues.length>2)bad();
 for(const d of c.displayValues){shape(d,['binding','name','revision','source']);shape(d.binding,['subject','instanceId']);if(d.source!=='engine-query'||d.revision!==c.revision||typeof d.name!=='string'||d.name.length>100||proseProblem(d.name))bad();if(d.binding.instanceId===location.id&&d.name!==location.name)bad();}
 const index=node.choices.findIndex(x=>x.next===null&&!x.conditions.length&&!x.effects.length&&!x.setTags.length&&!x.unsetTags.length),exit=node.choices[index];
 shape(c.exitChoice,['actionId','label','next','conditions','effects','setTags','unsetTags']);
 if(!exit||c.exitChoice.actionId!==`progression:action.story.${index}`||c.exitChoice.label!==exit.label||c.exitChoice.next!==null||['conditions','effects','setTags','unsetTags'].some(k=>!Array.isArray(c.exitChoice[k as 'conditions'])||c.exitChoice[k as 'conditions'].length))bad();
 for(const e of p.lexemes){
  validateLexeme(e);if(e.review!=='approved'||e.contentTier!=='general'||e.tagIds.length)bad();
  if(!e.id.startsWith('runtime:')){const o=location.proseScenery?.find(o=>o.sourceId===e.id&&o.id===e.binding.instanceId);if(!o||o.text!==e.text||e.binding.subject!==c.bindings.place.subject)bad();}
 }
 const replay=replayAProse(node,p);if(replay.mode!==p.mode||replay.text!==p.text)bad();
}
