export const version='1.3';
export const slots=['place','propEnv','bodyPart','senseMod','actionCore','materialFluid','opponentForm','exitChoice'];
export const themes=['modern','cyberpunk','steampunk','fantasy','xianxia','desert','polar','volcanic','jungle','underground','underwater','floating','harbor','western','dungeon','space-station','post-apocalypse'];
const pool=(id,slot,subjectType,role='core',extra={})=>({id,slot,subjectType,role,authoringTarget:true,contentTier:'general',...extra});
export const pools=[
 pool('place.current','place','location','core',{authoringTarget:false}),pool('actor.name','opponentForm','person','core',{authoringTarget:false}),pool('exit.current','exitChoice','event','core',{authoringTarget:false}),
 pool('environment.prop','propEnv','object'),
 pool('environment.sense','senseMod','location','core',{grammar:'名词短语；仅配“你察觉到”等通用感知连接词；不假定具体感官通道。'}),
 ...['smell','sound','light','thermal','touch'].map(channel=>pool('environment.sense.'+channel,'senseMod','location','core',{channel,runtimeAlsoIn:['environment.sense']})),
 pool('actor.form','opponentForm','person'),pool('action.observed','actionCore','person'),pool('actor.bodyPart','bodyPart','part'),
 pool('body.material','materialFluid','part'),pool('body.material.qualifier','materialFluid','part','qualifier'),
 pool('material.current','materialFluid','object'),pool('material.qualifier','materialFluid','object','qualifier'),
];
export const bindingRoles={place:'location',actor:'person',part:'part',prop:'object',material:'object',sense:'location',exit:'event'};
const fact=(id,valueType,bindingKey,meaning,extra={})=>({id,valueType,bindingKey,meaning,mappingStatus:'fixture-only',productionAdapterImplemented:false,...extra});
export const facts=[
 fact('actor.present','boolean','actor','绑定人物在当前地点在场。'),
 fact('part.kind','string','part','真实部件 kind。',{values:['root','head','ear','arm','hand','leg','foot','tail']}),
 fact('part.changed','boolean','part','对照明确历史记录确认部件是否发生变化；无记录为未知。'),
 fact('part.material','string','part','绑定部件的真实材质标识；不从正文或种族称呼推断。'),
 fact('part.finish','string','part','绑定部件已记录的表面状态；生产查询尚未接入。'),
 fact('action.observed','string','actor','已发生并记录的绑定人物动作，不由候选词创造。'),
 fact('prop.kind','string','prop','绑定环境物件的真实类型。'),
 fact('prop.contains','string','prop','物件所包含的另一个精确实例 ID。'),
 fact('material.kind','string','material','绑定材料/流体的真实种类。'),
 fact('water.filtered','boolean','material','当前水实例的过滤事实；不得借用另一杯水。'),
 fact('sense.available','boolean','sense','当前地点该感知通道的记录可用。'),
 fact('sense.channel','string','sense','感官通道。',{values:['smell','sound','light','thermal','touch']}),
 fact('sense.sample','string','sense','该通道当前已记录的具体感知内容。'),
 fact('scene.setting','string','place','当前世界题材的权威快照值；不把编辑分类 Tag 当现场事实。'),
];
export const quotas={templates:{A1:{'01':[6,8],'03':[6,8],'05':[6,8]},A2:{'02':[6,8],'04':[6,8],'06':[6,8],'07':[6,8],'09':[6,8]},A3:{'08':[6,8]}},mvpThemes:['modern','cyberpunk','fantasy','xianxia','post-apocalypse'],firstBatch:{B1:{'environment.prop':40,'environment.sense.*':25},B2:{'actor.form':30,'action.observed':40}},secondBatch:{B1:{'environment.prop':25,'environment.sense.*':15},B2:{'actor.form':20,'action.observed':25}},generic:{B3:{'actor.bodyPart':40,'body.material':15,'body.material.qualifier':30,'material.current':20,'material.qualifier':30}},totals:{templates:[54,72],words:810}};
