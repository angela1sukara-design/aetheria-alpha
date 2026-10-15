import type {Condition,Id} from './types.ts';
export type ProseMode='environment'|'person'|'body';
export interface ProseBinding {subject:string;instanceId:string}
export interface ProseToken {key:string;slot:string;poolId:string;bindTo:string;required:boolean;prefix:string;suffix:string;sameAs?:string[];subjectAs?:string[];prefixPools?:{poolId:string;required:boolean;separator:string}[]}
export interface ProseRule {id:string;domain:string;mode:'prose';contentTier:'general';fallbackTier:'general';proseTemplate:ProseToken[];prose:string;checks:string[]}
export interface ProseCatalog {format:'aetheria-prose-assembly-rules';schemaVersion:1;version:string;runtimeIntegrated:false;slots:string[];selection:{strategy:'bounded-lazy-search';maxCandidatesPerSlot:number;maxSteps:number;tieBreak:'seed-and-entry-id';cartesianEnumeration:false};rules:ProseRule[]}
export interface ProseLexeme {id:string;text?:string;displayRef?:{field:'name'};allowedSlots:string[];poolIds:string[];priority:number;review:'approved';status:'active';role:'core'|'qualifier';binding:ProseBinding;requires:{fact:string;comparison:'eq'|'exists';value?:string|number|boolean}[];excludes:string[];exclusive:{group:string;value:string}[];contentTier:'general';tagIds:string[];actionId?:string}
export interface ProseContext {seed:number;revision:number;bindings:Record<string,ProseBinding>;facts:Record<string,{known:true;source:'snapshot'|'engine-query';value:string|number|boolean}>;registeredTags:{id:string;status:'active'}[];displayValues:{binding:ProseBinding;name:string;revision:number;source:'snapshot'|'engine-query'}[];exitChoice:{actionId:string;label:string;next:null;conditions:[];effects:[];setTags:[];unsetTags:[]}}
export interface ProseInput {catalog:ProseCatalog;assemblyRuleId:string;lexemes:ProseLexeme[];context:ProseContext}
export interface ProseResult {mode:'assembled'|'fallback'|'blocked'|'auditOnly';text:string;reason?:string;selected?:{key:string;slot:string;entryId:string;binding:ProseBinding}[];steps:number}
export interface ProseSnapshot {version:1;nodeId:Id;ruleId:string;mode:'assembled'|'fallback';text:string;lexemes:ProseLexeme[];context:ProseContext}
/** Explicit generated scenery instances, not inventory or resident attributes. */
export interface ProseScenery {id:string;sourceId:string;kind:'prop'|'sense';text:string;conditions:Condition[]}
