import type { ActionDef, Effect, GameState, Id } from '../core/types.ts';
import type { AdventureState, DefeatReactionRule, NarrativeKind, NarrativeNode, ScopedTag } from '../core/adventure-types.ts';
import type { Registry } from '../content/registry.ts';
import type { EffectContext } from './effects.ts';
import { RuleError } from '../core/errors.ts';
import { evaluate } from './conditions.ts';
import { draw } from './rng.ts';
import { drawDefeatPlayFills, opponentLabelForKind } from './defeat-play-draws.ts';
import { drawWildDefeatCombo, wildDefeatBaseProfileId } from './wild-defeat-draws.ts';
import { derivedSemantics } from './semantic-query.ts';
import { environment } from './query.ts';
import { sceneContext } from './scene-context.ts';
import { proseProblem } from '../content/player-prose.ts';
import { residentTraits,conversationResident,conversationPresent,structuredConversation,conversationMemory } from './personality.ts';
import { residentInteraction } from './district.ts';
import {captureAProse} from './a-prose.ts';

export function initialAdventure(): AdventureState { return {version:1,assets:0,influence:0,safety:0,reputation:0,orders:0,contracts:0,victories:{},daily:{},equipment:{},items:{},story:null,journal:[],lastCombat:null}; }
export function adventure(s:GameState):AdventureState { if(!s.adventure){s.adventure=initialAdventure();s.adventure.daily['world.day']=Math.floor(s.clock.totalMinutes/1440);}return s.adventure; }
const key = (t:ScopedTag) => t.role+'/'+t.tagId;
export function narrativeTags(s:GameState,r:Registry):ScopedTag[] {
  const has = (id: string) => typeof r.hasTag === 'function' ? r.hasTag(id) : r.tags.some(t => t.id === id);
  const story=s.adventure?.story;
  const tags=[...(story?.tags??[])];
  const derived=new Set(r.derivedTags.map(t=>t.tagId));
  const live=tags.filter(t=>!derived.has(t.tagId));
  if(story?.kind==='conversation'&&story.actor?.kind==='resident')live.push(...residentTraits(s,r,conversationResident(s)).map(tagId=>({role:'opponent' as const,tagId})));
  live.push(...derivedSemantics(s,r,{entity:{kind:'player'}}).map(tagId=>({role:'player' as const,tagId})));
  live.push(...derivedSemantics(s,r,{world:true}).map(tagId=>({role:'environment' as const,tagId})));
  for(const tag of s.worldInstance?.definition.locations.find(l=>l.id===s.world.locationId)?.tags??[])if(has(tag))live.push({role:'environment',tagId:tag as Id});
  for(const tag of r.locationProfiles.find(p=>p.locationId===s.world.locationId)?.tags??[])if(has(tag))live.push({role:'environment',tagId:tag as Id});
  const service=environment(s,r).service;if(service.known&&has(`foundation:service.${service.value}`))live.push({role:'environment',tagId:`foundation:service.${service.value}`});
  return [...new Map(live.map(t=>[key(t),t])).values()];
}
function nodeWeight(
  n: NarrativeNode,
  profile?: Registry['narrativeProfiles'][number],
  activeEnvTags?: Set<string>,
  opponentTraits?: Set<string>,
  enemy?: Registry['enemies'][number],
): number {
  return Math.max(1, n.weight + n.tendencies.reduce((sum, t) => {
    const profileBoost = (profile?.tendencies.find(x => x.tagId === t.tagId)?.weight ?? 0)
      + (profile?.fetishTendencies?.find(x => x.tagId === t.tagId)?.weight ?? 0)
      + (enemy?.fetishTendencies?.find(x => x.tagId === t.tagId)?.weight ?? 0);
    const envBoost = !profileBoost && activeEnvTags?.has(t.tagId) ? 1 : 0;
    const traitBoost = opponentTraits?.has(t.tagId) ? 1 : 0;
    return sum + (profileBoost + envBoost + traitBoost) * t.weight;
  }, 0));
}
function chooseNode(s:GameState,r:Registry,stage:string):NarrativeNode|undefined {
  const story=adventure(s).story!;story.stage=stage;
  const activeScoped = narrativeTags(s,r);
  const tags=new Set(activeScoped.map(key)),profile=r.narrativeProfiles.find(p=>p.id===story.profileId);
  const enemy = profile?.enemyId ? r.enemies.find(e => e.id === profile.enemyId) : story.kind === 'defeat' && s.adventure?.lastCombat?.enemyId ? r.enemies.find(e => e.id === s.adventure!.lastCombat!.enemyId) : undefined;
  const envTagIds = new Set(activeScoped.filter(t => t.role === 'environment').map(t => t.tagId));
  const opponentTraits=new Set([
    ...residentTraits(s,r,conversationResident(s)),
    ...activeScoped.filter(t => t.role === 'opponent').map(t => t.tagId),
  ]);
  let pool=r.narrativeNodes.filter(n=>(!profile?.nodeIds||profile.nodeIds.includes(n.id))&&n.kind===story.kind&&n.stage===stage&&(story.visits[n.id]??0)<n.maxVisits&&n.requiresTags.every(t=>tags.has(key(t)))&&!n.excludesTags.some(t=>tags.has(key(t)))&&n.conditions.every(c=>evaluate(c,s,r).pass));
  if(!pool.length)return;
  const priority=Math.max(...pool.map(n=>n.priority));pool=pool.filter(n=>n.priority===priority).sort((a,b)=>a.id.localeCompare(b.id,'en'));
  const weight=(n:NarrativeNode)=>nodeWeight(n, profile, envTagIds, opponentTraits, enemy);
  let roll=draw(s,`narrative:${story.instanceId}`)*pool.reduce((sum,n)=>sum+weight(n),0);
  const selected=pool.find(n=>(roll-=weight(n))<0)??pool.at(-1)!;
  if(selected.proseAssembly)story.prose=captureAProse(s,r,selected);else delete story.prose;
  const problem=proseProblem(story.prose?.text??applyNarrativeFills(r.text(selected.textKey),story,s,r));
  if(problem)throw new RuleError('NARRATIVE_TEXT',`这段内容尚未准备好：${problem}。`);
  story.nodeId=selected.id;story.visits[selected.id]=(story.visits[selected.id]??0)+1;return selected;
}
export function startNarrative(s:GameState,r:Registry,c:EffectContext,kind:NarrativeKind,profileId?:Id,initialStage='start'):void {
  if(s.district?.combat||s.district?.scene||s.activeEventStack.length||s.adventure?.story)throw new RuleError('NARRATIVE_BUSY','先结束眼前的交锋或故事。');
  const a=adventure(s),profile=profileId?r.narrativeProfiles.find(p=>p.id===profileId):kind==='defeat'?r.narrativeProfiles.find(p=>p.enemyId===a.lastCombat?.enemyId):undefined;
  if(profileId&&!profile)throw new RuleError('NARRATIVE_PROFILE','行为档案不存在。');
  const enemy = profile?.enemyId ? r.enemies.find(e => e.id === profile.enemyId) : kind === 'defeat' && a.lastCombat?.enemyId ? r.enemies.find(e => e.id === a.lastCombat!.enemyId) : undefined;
  const resident=s.district?.residents.find(n=>n.id===s.district?.currentResidentId&&n.locationId===s.world.locationId);
  if(kind==='conversation'&&!resident)throw new RuleError('NO_RESIDENT','交谈对象此刻不在这里。');
  const rawTags:ScopedTag[]=[
    ...(kind==='defeat'?a.lastCombat?.tags??[]:[]),
    ...(profile?.tags??[]).map(tagId=>({role:'opponent' as const,tagId})),
    ...(profile?.goals.slice(0,1)??[]).map(tagId=>({role:'opponent' as const,tagId})),
    ...(profile?.attributeTags??[]).map(tagId=>({role:'opponent' as const,tagId})),
    ...(profile?.fetishTags??[]).map(tagId=>({role:'opponent' as const,tagId})),
    ...(kind==='defeat'?[...(enemy?.attributeTags??[]),...(enemy?.fetishTags??[])].map(tagId=>({role:'opponent' as const,tagId})):[]),
  ];
  const tags:ScopedTag[]=[...new Map(rawTags.map(t=>[key(t),t])).values()];
  let opponentName=kind==='defeat'?a.lastCombat?.enemyName??enemy?.name??'对方':resident?.name??s.district?.residents.find(n=>n.locationId===s.world.locationId)?.name??'对方';
  let fills:Record<string,string>|undefined;
  const comboCfg = profile?.defeatCombo ?? enemy?.defeatCombo;
  const speciesKind = profile?.speciesKind ?? enemy?.speciesKind;
  // fantasy 战败 8 玩法或开启了 autoCombo 的敌方档案：抽取对手种类 + 定词材质 + 部位 + 通用 TF
  if(profile?.id==='progression:profile.defeat.play' || comboCfg?.autoCombo){
    const drawn=drawDefeatPlayFills(s,`defeat-play:fill:${c.transactionId}`, {
      speciesKind,
      defeatCombo: comboCfg,
    });
    if(profile?.id==='progression:profile.defeat.play'){
      opponentName=opponentLabelForKind(drawn.opponentKind);
    }
    fills={
      opponentKind:drawn.opponentKind,
      materialKey:drawn.materialKey,
      material:drawn.material,
      materialBase:drawn.materialBase,
      dingci:drawn.dingci||'（无定词）',
      materialTrace:drawn.materialTrace,
      part:drawn.part,
      tf:drawn.tf,
      comboSample:drawn.comboSample,
      playKey:drawn.playKey,
    };
  }
  const wildBase=profile?.id?wildDefeatBaseProfileId(profile.id):undefined;
  if(wildBase){
    const drawn=drawWildDefeatCombo(s,wildBase,`wild-defeat:fill:${c.transactionId}`);
    const enemy=r.enemies.find(e=>e.id===profile?.enemyId);
    opponentName=enemy?.name??opponentName;
    tags.push({role:'opponent',tagId:drawn.comboTagId});
    fills={
      material:drawn.material,
      part:drawn.part,
      action:drawn.action,
      comboKey:drawn.comboKey,
      ...(drawn.tf?{tf:drawn.tf}:{})
    };
  }
  a.story={instanceId:c.transactionId,kind,stage:'start',nodeId:'progression:unselected',profileId:profile?.id??null,opponentName,actor:resident?{kind:'resident',id:resident.id}:profile?.npcId?{kind:'npc',id:profile.npcId}:null,tags,visits:{},log:[],steps:0,...(fills?{fills}:{})};
  if(kind==='conversation'&&residentTraits(s,r,resident).length){
    a.story.actor={kind:'resident',id:resident!.id};a.story.opponentName=resident!.name;
    const before=resident!.trust;residentInteraction(s,r,false);if(resident!.trust!==before)c.changes.push({label:`${resident!.name}的信任`,before,after:resident!.trust});
  }
  if(!chooseNode(s,r,initialStage)){a.story=null;throw new RuleError('NO_NARRATIVE','当前没有适用的故事节点。');}
}
function applyNarrativeFills(text:string,story:NonNullable<AdventureState['story']>,s:GameState,r:Registry):string{
  let out=text.replaceAll('{opponent}',story.opponentName);
  for(const [key,value] of Object.entries({...sceneContext(s,r),...story.fills})) out=out.replaceAll('{'+key+'}',value);
  return out;
}
export function narrativeText(s:GameState,r:Registry):string|undefined {
  const story=s.adventure?.story;if(!story)return;
  if(structuredConversation(s,r)&&!conversationPresent(s))return '交谈已经结束\n\n对方已经离开这里。你可以结束这次交谈，继续自己的安排。';
  const node=r.narrativeNodes.find(n=>n.id===story.nodeId)!;
  const replace=(text:string)=>applyNarrativeFills(text,story,s,r);
  return `${replace(node.title)}\n\n${story.prose?.text??replace(r.text(node.textKey))}${story.log.length?'\n\n'+replace(story.log.at(-1)!):''}`;
}
export function narrativeTitle(s:GameState,r:Registry):string|undefined {
  if(structuredConversation(s,r)&&!conversationPresent(s))return '交谈已经结束';
  const story=s.adventure?.story,node=r.narrativeNodes.find(n=>n.id===story?.nodeId);
  return story&&node?applyNarrativeFills(node.title,story,s,r):undefined;
}
export function resolveDefeatReactionStage(targetStage: string | null, currentStage: string): string | null {
  if (!targetStage) return null;
  const m = /^(play-\d+)(?:-.+)?$/.exec(currentStage);
  const prefix = m ? m[1]! : 'play-01';
  return targetStage.replace('{playPrefix}', prefix);
}
export function matchingDefeatReactions(s: GameState, r: Registry): DefeatReactionRule[] {
  const story = s.adventure?.story;
  if (!story || story.kind !== 'defeat') return [];
  return (r.defeatReactionRules ?? [])
    .filter(rule => {
      const stageMatch = rule.stages.some(st => st === '*' || story.stage === st || story.stage.endsWith('-' + st));
      if (!stageMatch) return false;
      return rule.playerConditions.every(c => evaluate(c, s, r).pass)
        && rule.opponentConditions.every(c => evaluate(c, s, r).pass);
    })
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id, 'en'));
}
export function narrativeActions(s:GameState,r:Registry):ActionDef[]|undefined {
  const story=s.adventure?.story;if(!story)return;
  const node=r.narrativeNodes.find(n=>n.id===story.nodeId)!;
  const departed=structuredConversation(s,r)&&!conversationPresent(s);
  const baseChoices = node.choices.flatMap((choice,index)=>{
    if(departed&&!safeConversationExit(choice))return [];
    const costs=choice.effects.some(e=>e.op==='progression.act'||e.op==='var.change'&&e.amount<0);
    const time=choice.effects.filter(e=>e.op==='clock.advance').reduce((n,e)=>n+(e.op==='clock.advance'?e.minutes:0),0);
    return [{...r.action(`progression:action.story.${index}`),label:applyNarrativeFills(choice.label,story,s,r),conditions:choice.conditions,hint:costs?'按选项结算行动消耗':time?'按下方耗时执行':choice.next?'继续当前经历':'结束当前经历；无资源费用'}];
  });
  if (story.kind === 'defeat' && node.choices.length < 4) {
    const reactions = matchingDefeatReactions(s, r);
    if (reactions.length) {
      const top = reactions[0]!;
      const idx = node.choices.length;
      baseChoices.push({
        ...r.action(`progression:action.story.${idx}`),
        label: applyNarrativeFills(top.choiceLabel, story, s, r),
        conditions: [...top.playerConditions, ...top.opponentConditions],
        hint: '双方属性对偶反应 · 动态触发分支',
      });
    }
  }
  return baseChoices;
}
/** Read the current option's public effects for cost and eligibility checks, without advancing it. */
export function publicActionEffects(action:ActionDef,s:GameState,r:Registry):Effect[] {
  return action.effects.flatMap(e=>{
    if (e.op !== 'narrative.choose') return [e];
    const node = r.narrativeNodes.find(n=>n.id===s.adventure?.story?.nodeId);
    if (node && e.index === node.choices.length && s.adventure?.story?.kind === 'defeat') {
      return matchingDefeatReactions(s, r)[0]?.effects ?? [];
    }
    return node?.choices[e.index]?.effects ?? [];
  });
}
export function advanceNarrative(s:GameState,r:Registry,c:EffectContext,index:number,apply:(effects:import('../core/types.ts').Effect[],s:GameState,r:Registry,c:EffectContext)=>void):void {
  const a=adventure(s),story=a.story,node=r.narrativeNodes.find(n=>n.id===story?.nodeId);
  let choice=node?.choices[index];
  if (!choice && story?.kind === 'defeat' && node && index === node.choices.length) {
    const top = matchingDefeatReactions(s, r)[0];
    if (top) {
      choice = {
        label: top.choiceLabel,
        resultText: top.resultText,
        conditions: [...top.playerConditions, ...top.opponentConditions],
        effects: top.effects,
        setTags: top.setTags,
        unsetTags: top.unsetTags,
        next: resolveDefeatReactionStage(top.targetStage, story.stage),
      };
    }
  }
  if(!story||!node||!choice||!choice.conditions.every(x=>evaluate(x,s,r).pass))throw new RuleError('NARRATIVE_CHOICE','当前选择不可用。');
  if(structuredConversation(s,r)&&!conversationPresent(s)&&!safeConversationExit(choice))throw new RuleError('CONVERSATION_LEFT','交谈对象已经离开。');
  c.narrativeChoice={nodeId:node.id,index};
  apply(choice.effects,s,r,c);
  const unset=new Set(choice.unsetTags.map(key));story.tags=story.tags.filter(t=>!unset.has(key(t)));
  story.tags=[...new Map([...story.tags,...choice.setTags].map(t=>[key(t),t])).values()];story.steps++;
  const line=applyNarrativeFills(r.text(choice.resultText),story,s,r);
  const problem=proseProblem(line);if(problem)throw new RuleError('NARRATIVE_TEXT',`这段内容尚未准备好：${problem}。`);
  story.log.push(line);story.log=story.log.slice(-12);c.resolvedTexts.push(line);
  if(choice.next&&story.steps<12&&(!structuredConversation(s,r)||conversationPresent(s))&&chooseNode(s,r,choice.next))return;
  if(story.kind==='defeat'&&s.player.variables['core:health']!<1){s.player.variables['core:health']=1;c.changes.push({label:'脱离危险',before:0,after:1});}
  a.journal.push({at:s.clock.totalMinutes,title:applyNarrativeFills(node.title,story,s,r),text:story.log.join('\n')});a.journal=a.journal.slice(-64);delete s.rng.streams[`narrative:${story.instanceId}`];for(const k of Object.keys(s.rng.streams))if(k.startsWith(`defeat-play:fill:${story.instanceId}`))delete s.rng.streams[k];a.story=null;
}

function safeConversationExit(choice:NarrativeNode['choices'][number]):boolean{return choice.next===null&&!choice.conditions.length&&!choice.effects.length;}
/** 在不写入或抽随机数的前提下检查新性格对话的候选池。 */
export function personalityConversationAvailable(s:GameState,r:Registry):boolean{
  if(s.adventure?.story)return false;
  const n=s.district?.residents.find(n=>n.id===s.district?.currentResidentId&&n.locationId===s.world.locationId),traits=residentTraits(s,r,n);
  if(!n||!traits.length||n.memories.includes(conversationMemory(s,'declined')))return false;
  const probe:GameState={...s,adventure:{...(s.adventure??initialAdventure()),story:{instanceId:'preview',kind:'conversation',stage:'start',nodeId:'progression:unselected',profileId:null,opponentName:n.name,actor:{kind:'resident',id:n.id},tags:[],visits:{},log:[],steps:0}}};
  const tags=new Set(narrativeTags(probe,r).map(key));
  return r.narrativeNodes.some(node=>node.kind==='conversation'&&node.stage==='start'&&node.requiresTags.some(t=>t.role==='opponent'&&traits.includes(t.tagId))&&node.requiresTags.every(t=>tags.has(key(t)))&&!node.excludesTags.some(t=>tags.has(key(t)))&&node.conditions.every(c=>evaluate(c,probe,r).pass));
}
export function conversationEntryAction(a:ActionDef,s:GameState,r:Registry):ActionDef{
  if(a.context||!a.effects.some(e=>e.op==='resident.talk')||!personalityConversationAvailable(s,r))return a;
  const n=s.district!.residents.find(n=>n.id===s.district!.currentResidentId)!;
  return {...a,label:`与${n.name}交谈`,hint:'5分钟 · 交流记录每日一次 · 按人物性格展开',effects:a.effects.map(e=>e.op==='resident.talk'?{op:'narrative.start' as const,kind:'conversation' as const}:e)};
}

export interface NarrativeDebugTrace {
  node: NarrativeNode;
  profileId: Id | null;
  activeTags: { role: ScopedTag['role']; tagId: Id; label: string; origin: string }[];
  baseWeight: number;
  finalWeight: number;
  tendencyHits: { tagId: Id; label: string; nodeWeight: number; multiplier: number; added: number }[];
  candidates: { id: Id; title: string; priority: number; weight: number; selected: boolean }[];
  rejected: { id: Id; title: string; reason: string }[];
  fillsUsed: { placeholder: string; value: string }[];
}

/** Debug 专用：解释当前故事节点（NarrativeNode）是如何通过 Tag、条件、倾向加权与候选池竞争被选出的。只读不改状态。 */
export function explainNarrativeNode(s: GameState, r: Registry): NarrativeDebugTrace | undefined {
  const story = s.adventure?.story;
  if (!story) return undefined;
  const node = r.narrativeNodes.find(n => n.id === story.nodeId);
  if (!node) return undefined;
  const profile = r.narrativeProfiles.find(p => p.id === story.profileId);
  const enemy = profile?.enemyId ? r.enemies.find(e => e.id === profile.enemyId) : story.kind === 'defeat' && s.adventure?.lastCombat?.enemyId ? r.enemies.find(e => e.id === s.adventure!.lastCombat!.enemyId) : undefined;
  const activeScoped = narrativeTags(s, r);
  const tagSet = new Set(activeScoped.map(key));
  const envTagIds = new Set(activeScoped.filter(t => t.role === 'environment').map(t => t.tagId));
  const opponentTraits=new Set([
    ...residentTraits(s,r,conversationResident(s)),
    ...activeScoped.filter(t => t.role === 'opponent').map(t => t.tagId),
  ]);
  const playerDerived = new Set(derivedSemantics(s, r, { entity: { kind: 'player' } }));
  const worldDerived = new Set(derivedSemantics(s, r, { world: true }));
  const locTags = new Set(s.worldInstance?.definition.locations.find(l => l.id === s.world.locationId)?.tags ?? []);
  const profTags = new Set(r.locationProfiles.find(p => p.locationId === s.world.locationId)?.tags ?? []);

  const labelOf = (id: Id) => { try { return r.tag(id).label; } catch { return id; } };
  const activeTags = activeScoped.map(t => {
    let origin = '故事运行态 (story.tags)';
    if (t.role === 'player' && playerDerived.has(t.tagId)) origin = '玩家身体/状态派生 (derivedSemantics)';
    else if (t.role === 'environment') {
      if (t.tagId.startsWith('foundation:service.')) origin = '当前地点服务 (location.service)';
      else if (worldDerived.has(t.tagId)) origin = '世界环境派生 (derivedSemantics)';
      else if (locTags.has(t.tagId)) origin = '世界生成地点标签 (worldInstance.locations)';
      else if (profTags.has(t.tagId)) origin = '地点环境档案 (locationProfiles)';
    } else if(t.role==='opponent'&&residentTraits(s,r,conversationResident(s)).includes(t.tagId)){
      origin=`绑定居民性格 (${story.actor?.kind==='resident'?story.actor.id:''})`;
    } else if (t.role === 'opponent' && enemy && ((enemy.attributeTags ?? []).includes(t.tagId) || (enemy.fetishTags ?? []).includes(t.tagId))) {
      origin = `敌方属性/性癖倾向 (${enemy.id})`;
    } else if (t.role === 'opponent' && profile && (profile.tags.includes(t.tagId) || profile.goals.includes(t.tagId) || (profile.attributeTags ?? []).includes(t.tagId) || (profile.fetishTags ?? []).includes(t.tagId))) {
      origin = `对手/NPC行为档案 (${profile.id})`;
    }
    return { role: t.role, tagId: t.tagId, label: labelOf(t.tagId), origin };
  });

  const tendencyHits: NarrativeDebugTrace['tendencyHits'] = [];
  for (const t of node.tendencies) {
    const profileBoost = (profile?.tendencies.find(x => x.tagId === t.tagId)?.weight ?? 0)
      + (profile?.fetishTendencies?.find(x => x.tagId === t.tagId)?.weight ?? 0)
      + (enemy?.fetishTendencies?.find(x => x.tagId === t.tagId)?.weight ?? 0);
    const envBoost = !profileBoost && envTagIds.has(t.tagId) ? 1 : 0;
    const mult = profileBoost + envBoost + (opponentTraits.has(t.tagId)?1:0);
    if (mult > 0) {
      tendencyHits.push({ tagId: t.tagId, label: labelOf(t.tagId), nodeWeight: t.weight, multiplier: mult, added: mult * t.weight });
    }
  }

  const sameKindStage = r.narrativeNodes.filter(n => n.kind === story.kind && n.stage === story.stage);
  const passed: NarrativeNode[] = [];
  const rejected: NarrativeDebugTrace['rejected'] = [];
  for (const cand of sameKindStage) {
    if(profile?.nodeIds&&!profile.nodeIds.includes(cand.id)){
      rejected.push({id:cand.id,title:cand.title,reason:'不在当前入口的候选节点范围内'});
      continue;
    }
    const missingReq = cand.requiresTags.find(t => !tagSet.has(key(t)));
    if (missingReq) {
      rejected.push({ id: cand.id, title: cand.title, reason: `缺少硬性 Tag：${missingReq.role}/${labelOf(missingReq.tagId)} (${missingReq.tagId})` });
      continue;
    }
    const hitExcl = cand.excludesTags.find(t => tagSet.has(key(t)));
    if (hitExcl) {
      rejected.push({ id: cand.id, title: cand.title, reason: `命中互斥 Tag：${hitExcl.role}/${labelOf(hitExcl.tagId)} (${hitExcl.tagId})` });
      continue;
    }
    const failedCond = cand.conditions.map(c => ({ c, res: evaluate(c, s, r) })).find(x => !x.res.pass);
    if (failedCond) {
      rejected.push({ id: cand.id, title: cand.title, reason: `条件未满足：${failedCond.res.reason || failedCond.c.op}` });
      continue;
    }
    const usedVisits = (story.visits[cand.id] ?? 0) - (cand.id === node.id ? 1 : 0);
    if (usedVisits >= cand.maxVisits) {
      rejected.push({ id: cand.id, title: cand.title, reason: `单次故事访问上限已满 (${usedVisits}/${cand.maxVisits})` });
      continue;
    }
    passed.push(cand);
  }
  const maxPriority = passed.length ? Math.max(...passed.map(n => n.priority)) : node.priority;
  const topPool = passed.filter(n => n.priority === maxPriority).sort((a, b) => a.id.localeCompare(b.id, 'en'));
  for (const low of passed.filter(n => n.priority < maxPriority)) {
    rejected.push({ id: low.id, title: low.title, reason: `优先级低于最高候选 (${low.priority} < ${maxPriority})` });
  }
  const candidates = topPool.map(cand => ({
    id: cand.id,
    title: cand.title,
    priority: cand.priority,
    weight: nodeWeight(cand, profile, envTagIds, opponentTraits, enemy),
    selected: cand.id === node.id,
  }));

  const rawTemplate = r.text(node.textKey);
  const allFills: Record<string, string> = { opponent: story.opponentName, ...sceneContext(s, r), ...(story.fills ?? {}) };
  const fillsUsed: { placeholder: string; value: string }[] = [];
  for (const [k, v] of Object.entries(allFills)) {
    if (rawTemplate.includes(`{${k}}`) || node.title.includes(`{${k}}`)) {
      fillsUsed.push({ placeholder: `{${k}}`, value: v });
    }
  }

  return {
    node,
    profileId: story.profileId,
    activeTags,
    baseWeight: node.weight,
    finalWeight: nodeWeight(node, profile, envTagIds, opponentTraits, enemy),
    tendencyHits,
    candidates,
    rejected,
    fillsUsed,
  };
}
