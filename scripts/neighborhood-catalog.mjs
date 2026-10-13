// Authored starter content. Runtime reads the resulting reviewed JSON, not this
// authoring script. Future lexicon prose can replace descriptions independently.
const defaults = { environmentTags: [], weight: 10, requiresTags: [], excludesTags: [], compatibleTags: [], requiresPacks: ['aetheria/district'], combination: { requiresTemplates: [], excludesTemplates: [], boosts: [] }, contributes: { tags: [], npcTemplateIds: [], eventIds: [], tfIds: [] } };
export const template = (id, kind, data, options = {}) => ({ ...structuredClone(defaults), id, kind, data, ...options });
const ecologies = [
  { key:'wet', name:'雾潮街区', description:'潮雾绕着高架水槽流动，蕨叶从砖缝探出来。屋檐、排水沟和共用雨棚把日常活动串在一起。', tags:['climate.wet','ecology.fern','waterways'], names:['滴檐合住院','浮棚食集','铜叶工坊','雾灯护理站','雨声公共厅'], detail:'宽檐把细雨引向沟渠，走廊内侧留有干燥的通道。', industries:['住宅排水维护','食物防潮分装','水泵检修','护理用品消毒','公共路标核对'], factions:['潮汐互助会','水槽工联'], task:['一起检查防雨棚扣','当班人想请你核对棚扣编号与登记册，避免下一场雨来时混淆。','你把实际编号写进登记册，交接人核对后结清报酬。'], walk:['沿水槽观察排水','你沿公共水槽走了一段，辨认了排水口与避雨处，回到起点。'] },
  { key:'dry', name:'晴砾街区', description:'日光照亮挡风棚，旱生灌木沿石墙生长。厚墙、镜板和遮阳帘在石路上分出明暗不同的空间。', tags:['climate.dry','ecology.shrub','solar'], names:['遮阳共享院','晴棚干货市','镜板维修坊','凉荫适配室','风影交接厅'], detail:'遮阳帘之间留着通风的缝，门边有拂去鞋底浮沙的垫子。', industries:['遮阳帘维护','干货封装','镜板检修','护理用品分装','公共遮阳时段记录'], factions:['凉荫互助会','镜板工联'], task:['帮助标记遮阳时段','公共板上的遮阳记录有些模糊，当班人请你核对墙边刻度。','你按刻度补齐记录，并明确标出尚未核实的部分。'], walk:['观察石墙与遮阳通道','你沿阴影连续的公共通道慢行，记住了相邻院落的入口。'] },
  { key:'garden', name:'林荫街区', description:'树冠跨过连廊，雨水从叶片流向种植槽。住舍、苗圃和食物摊围绕几条透光的步道排列。', tags:['climate.garden','ecology.canopy','horticulture'], names:['叶影合住院','青枝食物集','枝架修配坊','绿廊护理站','种子交换厅'], detail:'树根旁有透气护栏，落叶收集箱与步行通道分开。', industries:['种植槽轮值','食材分拣','种植支架修补','公共护理','种子资料整理'], factions:['绿廊照护会','枝架合作社'], task:['核对苗圃标牌','公共种植槽的标牌顺序需要核对，当班人请你对照原始记录。','你保留了原记录，把已经核实的标牌重新排好。'], walk:['走过树冠步道','你沿有护栏的步道观察叶影和种植槽，回程时避开了维护区。'] },
  { key:'frost', name:'霜港街区', description:'浅霜覆着码头边的栏杆，地衣在背风墙角生长。保温廊道将住舍、储藏市场和热水护理站连在一起。', tags:['climate.frost','ecology.lichen','insulation'], names:['背风合住院','霜灯储货市','暖管维修坊','热水护理站','港口交接厅'], detail:'入口设有融霜垫，保温门帘后方留着可以停步的位置。', industries:['门帘维护','保温货物分装','热水管检修','恢复用品整理','公共通道标记'], factions:['背风互助会','暖管工联'], task:['检查保温门帘编号','当班人请你对照保温门帘的编号和维护记录，不需要进入设备区。','你完成编号核对，将缺失记录单独列出并交接。'], walk:['辨认保温廊道入口','你沿公共廊道慢行，记下保温门帘和融霜垫的位置。'] },
  { key:'forge', name:'炉巷街区', description:'回收金属在棚架下分门别类，耐热苔藓沿冷却渠生长。工坊的隔热门与住宅的通风庭院隔着宽阔公共通道。', tags:['climate.forge','ecology.moss','reclamation'], names:['通风共享院','铜秤回收集','冷渠修配坊','净尘护理站','工单交接厅'], detail:'材料箱与步行区之间划着清楚的边界，入口放着擦拭用具。', industries:['庭院通风维护','回收材料分拣','工具与冷却管检修','用品清洁','共享工具登记'], factions:['净尘照护会','回炉合作社'], task:['核对共享工具登记','公共工具架的归还记录需要复核，当班人请你整理清楚的编号。','你把已归还和待核实的工具分栏记录，没有擅自处置任何物件。'], walk:['观察回收巷的公共路线','你沿标出的步行区绕过材料棚，辨认了回程用的公共出口。'] },
  { key:'tidal', name:'咸汐街区', description:'盐雾越过护栏，海藻在低处的水道里摇动。高脚住舍和防潮库房沿抬高的木石通道分布。', tags:['climate.tidal','ecology.kelp','saltwater'], names:['高脚合住院','盐棚食物集','浮架维修坊','潮风护理站','栈桥消息厅'], detail:'抬高的公共通道设有排水缝，栏杆旁留出搬运与停步的空位。', industries:['住宅防潮轮值','食物密封分装','浮架连接检修','护理用品防潮整理','栈桥去向核对'], factions:['栈桥互助会','浮架工联'], task:['复核防潮箱编号','值班人请你在公共区对照防潮箱编号和交接单，箱内物件不需要打开。','你核对了编号与交接去向，标出不一致项交给值班人。'], walk:['沿高脚通道辨认路口','你沿有护栏的公共通道观察路口与排水缝，回到干燥的平台。'] },
];
const services = ['home','market','workshop','clinic','commons'];
const placeText = {
  home: ['公共厨房与休息区分开，住宅维护记录贴在门边。', ['交接信使','烘焙师','缝补工'], '共享厨房轮值'],
  market: ['称量台、收据夹和短时存放架排在公共通道两旁。', ['摊贩','烘焙师'], '日用品交易'],
  workshop: ['工具按用途放在可够到的架上，接单区与设备区分开。', ['维护电工','缝补工','水务工'], '工具修理'],
  clinic: ['护理座位、清洁用品架和公开适配流程各有标识。', ['护理员','交接信使'], '身体适配'],
  commons: ['公共消息板只登记可公开的信息，旁边有路线与资料桌。', ['交接信使','档案整理员','园艺工'], '公共资料交接'],
};
const ambience = {
  home: ['晨光落在公共餐桌边，轮值板上的日期清楚可见。','院内晾架投下短影，厨房用品按格归位。','公共灯照着走廊，门边的收纳箱留有空位。','住舍的灯光调暗，公共座位与通道仍然可以使用。'],
  market: ['遮棚下的价目板与空货筐都放在容易看见的位置。','称量台上的刻度反着光，收据夹用绳子固定。','储货架旁亮起低灯，封口工具收在台边。','摊架合拢了部分围板，公共通道和休息座位仍留着。'],
  workshop: ['斜光照在工具轮廓板上，工单夹按编号排列。','工作灯照亮检视台，公共区与设备区的标线清晰。','工具轮廓板旁亮起交接灯，柜门上的编号没有变化。','设备区的门关着，公共前廊仍然留有照明与座位。'],
  clinic: ['护理区的窗帘透进柔光，公开说明册摆在桌边。','清洁用品的封签清晰，恢复座位旁留有饮水。','走廊灯光渐暖，公开适配流程仍可查阅。','护理区外廊亮着低灯，免费恢复座位仍然开放。'],
  commons: ['消息板旁的晨光照出纸张的纹理，路线图固定在框内。','公共桌面留着阅读空位，资料卡分门别类。','交接灯亮起来，消息板边缘的阴影缓缓移动。','公共厅降低灯光，出入口标识和长凳仍能辨认。'],
};
const localTasks = {
  home:['整理轮值记录','公共厨房的轮值卡需要重新按日期归档。','你保留原有署名，按日期把轮值卡放回夹册。'],
  market:['核对空筐与收据','市场公共区的空筐编号需要与交接收据核对。','你核对了编号，把待确认的收据交回值班桌。'],
  workshop:['整理工具借用卡','工坊的公共工具借用卡需要按编号归位。','你将借用卡与空位标记一一对应，留下清楚的交接记录。'],
  clinic:['整理公开适配说明','护理站的公开说明册需要按版本号整理。','你保留原册，将新版和存档版分别放进标识清楚的格子。'],
  commons:['更新公共资料索引','公共厅的资料索引需要核对页码。','你补全核实过的页码，未找到的资料单独记在待查栏。'],
};
const activities = [
  ['home','meal','吃一份公共厨房简餐','你按公开价目取了一份简餐，在指定座位慢慢吃完并收好餐具。',20,8,-2,2,[]],
  ['home','laundry','整理衣物与工作用品','你整理工作用品，把暂时用不到的物件收好，留出活动空间。',20,3,0,0,['grasp']],
  ['home','kitchen','协助清点厨房用品','你按轮值要求清点公用餐具，核对结果后收到约定的报酬。',25,-4,3,0,['grasp']],
  ['market','food','尝一份摊位热食','你按标价买了热食，坐在公共座位吃完，精力逐渐恢复。',15,8,-3,1,[]],
  ['market','sorting','参与空筐分类','你将公共区的空筐按编号分类，与值班人核对后领取报酬。',25,-5,5,0,['grasp']],
  ['market','prices','阅读公开价目与交接板','你看过公开价目和交接信息，对市场眼下的安排多了一点了解。',15,2,0,0,[]],
  ['workshop','labels','核对公共工具标签','你在公共区核对工具标签，记录不一致项，完成后收到报酬。',30,-6,6,0,['grasp']],
  ['workshop','bench','清理公共检视台','你收好不用的夹具，按要求擦拭检视台，完成一段有报酬的整理工作。',25,-4,4,0,['grasp']],
  ['workshop','manual','阅读工具使用说明','你在公共阅读区看过工具说明，合上册子后活动了一下身体。',20,3,0,0,[]],
  ['clinic','recovery','使用免费恢复座位','你按公开说明使用恢复座位，补充饮水后慢慢恢复体况。',45,8,0,6,[]],
  ['clinic','supplies','协助清点封装用品','你在公共区域核对未拆封用品的编号，交接后收到报酬。',30,-4,4,0,['grasp']],
  ['clinic','care','了解当前身体的日常照护','你阅读与日常照护有关的公开说明，在座位上休息了一会儿。',20,4,0,2,[]],
  ['commons','reading','在公共资料桌阅读','你选了公开的资料卡，安静读过一段，再把它放回原位。',25,5,0,0,[]],
  ['commons','archive','协助整理公共索引','你按索引号归置资料卡，交给轮值人复核并领取报酬。',30,-3,4,0,['grasp']],
  ['commons','walk','沿公共通道散步','你沿有标识的公共通道走过一段，在座位上停下来整理思绪。',20,3,0,0,['walk']],
];
export function buildNeighborhoodCatalog() {
  const templates = [];
  for (const eco of ecologies) {
    const environmentTags = [`climate.${eco.key}`];
    templates.push(template(`base.environment.${eco.key}`, 'environment', { name:eco.name, description:eco.description, tags:eco.tags }));
    for (const [index, service] of services.entries()) for (const variant of [0,1]) {
      const [description, professions, secondEconomy] = placeText[service];
      const names = variant ? [eco.names[index]+'东院', eco.names[index]+'连廊'] : [eco.names[index],eco.names[index]+'西舍'];
      const contributes = { ...structuredClone(defaults.contributes), tags:[`service.${service}`], tfIds:service==='clinic'?['aetheria-tf:tf.tail.mechanical']:[] };
      templates.push(template(`base.place.${eco.key}.${service}${variant?'.annex':''}`, 'place', { service, names, description:`${eco.detail}${description}${variant?'连廊边设置了短时交接台，与主通道相接。':''}`, economy:[eco.industries[index],secondEconomy], professions, ambience:Object.fromEntries(['morning','day','evening','night'].map((key,i)=>[key,ambience[service][i]])) }, { environmentTags, contributes }));
      if (!variant) {
        const [label,prompt,completeText] = localTasks[service];
        templates.push(template(`base.event.${eco.key}.${service}`, 'event', { label, prompt:`${eco.detail}\n\n${prompt}你可以协助，也可以先继续自己的安排。`, completeText, minutes:20,reward:3 }, { environmentTags,requiresTags:[`service.${service}`] }));
      }
    }
    for (const [i,suffix] of ['care','trade'].entries()) templates.push(template(`base.faction.${eco.key}.${suffix}`, 'faction', { name:eco.factions[i],activities:i?['工具共享','工单交接']:['免费座位维护','公共照护轮值'] }, { environmentTags }));
    templates.push(template(`base.event.${eco.key}`, 'event', { label:eco.task[0],prompt:eco.task[1]+'你可以帮忙，也可以先离开。',completeText:eco.task[2],minutes:15,reward:3 }, { environmentTags }));
    templates.push(template(`base.event.${eco.key}.maintenance`, 'event', { label:'复核公共通道标识',prompt:`${eco.detail}\n\n值班人请你对照公开图纸检查通道标识，沿途不需要进入私人区域。也可以先离开。`,completeText:'你只记录了实际看到的标识，将待核实的部分交回值班桌。',minutes:20,reward:4 }, { environmentTags }));
    templates.push(template(`base.activity.${eco.key}`, 'activity', { label:eco.walk[0],description:eco.walk[1],minutes:20,energyChange:3,moneyChange:0,healthChange:0,capabilities:['walk'] }, { environmentTags }));
  }
  for (const [service,key,label,description,minutes,energyChange,moneyChange,healthChange,capabilities] of activities) templates.push(template(`base.activity.${service}.${key}`,'activity',{label,description,minutes,energyChange,moneyChange,healthChange,capabilities},{requiresTags:[`service.${service}`]}));
  for (const key of ['vendor','electrician']) templates.push(template(`base.npc.${key}`,'npc',{residentTemplateId:`district:resident.${key}`},{weight:1}));
  for (const key of ['vendor','electrician','courier','baker','stitcher','nurse','archivist','gardener','waterworker']) templates.push(template(`base.npc.neighborhood.${key}`,'npc',{residentTemplateId:`neighborhood:resident.${key}`},{requiresPacks:['aetheria/neighborhood-content'],weight:20}));
  return { format:'aetheria-reference',schemaVersion:1,id:'aetheria/neighborhood-reference',version:'0.2.0',templates };
}
const occupations = [
  ['vendor','摊贩','trade',['顾秤','Elena','罗沅','Marcus','江柚','Quinn'],['留意细节','说话爽快','重视公平称量'],['我在这里负责摊位与收据，公开价目都写在板上。','上次的交接还记着，这回也按老规矩来。','你们核对空筐和收据，把不确定的项目单独记下，没有擅自改动价目。']],
  ['electrician','维护电工','repair',['岑路','Kai','何线','Jonas','唐栎','Noah'],['谨慎耐心','习惯先核对编号','喜欢把话讲清楚'],['我处理公共线路的维护，设备区要按登记流程进入。','上次一起整理的记录还在，后来的情况也补进去了。','你在公共区托稳工具箱，对方核对借用编号，把设备操作留给具备资格的人员。']],
  ['courier','交接信使','guide',['苏途','Sera','陈舟','Ravi','吴晏','Aiko'],['说话简明','重视约定','喜欢确认去向'],['我负责公开交接与送达记录，私人信件不会拿来当谈资。','又见面了。上次交接的去向已经有明确记录。','你们核对公共路线卡与交接编号，没有翻阅私人信件。']],
  ['baker','烘焙师','trade',['简麦','Mira','杜谷','Logan','林酵','Ada'],['乐于分享经验','做事有条理','重视干净的工作台'],['我在厨房和市场间交接成品，配料与价目都有公开记录。','昨天记下的交接还留着，今天也能慢慢说。','你帮助清点已封装餐盒和公用餐具，不进入需要专门操作的制作区。']],
  ['stitcher','缝补工','repair',['叶针','Nora','程线','Wes','宁襟','Iris'],['细致温和','习惯先听清需求','珍惜可修复的东西'],['我接日常用品的修补，先确认尺寸和用途，再决定怎么处理。','上次的修补登记还在，你说过的需求没有弄丢。','你把公共样布与编号卡配好，对方复核后将工具归位，没有擅自改动别人的衣物。']],
  ['nurse','护理员','guide',['简沐','Helen','方澄','Theo','时安','Lina'],['语气平稳','尊重边界','解释耐心'],['我负责公共护理与用品交接。个人情况由当事人决定是否公开。','还记得上次的共同值班，这次也先把眼前需要做的事说清楚。','你协助清点未拆封用品，把登记交给对方，没有接触私人护理记录。']],
  ['archivist','档案整理员','guide',['沈页','Owen','白录','Vera','闻简','Jules'],['喜欢准确引用','不急着下结论','习惯区分已知与待查'],['我整理公开资料。没有核实的内容会留在待查栏，不当成事实。','你上次核对过的页码仍然保留，后来补的内容也标了日期。','你们核对公开索引与页码，把缺失项留给后续查证，没有打开受限档案。']],
  ['gardener','园艺工','guide',['岑禾','Ivy','林芽','Reed','陆荫','Nina'],['观察细致','喜欢有耐心的交流','重视轮值记录'],['我照看公共种植槽，轮值和维护范围都能在记录上找到。','上次写下的轮值仍然有记录，这一轮也会按实际情况交接。','你协助核对公共种植槽的标签，把工具送回架上，没有擅自施用任何材料。']],
  ['waterworker','水务工','repair',['罗渠','Cole','周汀','Dana','江闸','Pax'],['重视明确分工','言语直接','喜欢先检查再动手'],['我核对公共水务维护记录，实际设备要按工单和资格操作。','上次核对过的编号还在，这回也不会凭记忆乱改。','你在公共区把编号牌与交接单配对，设备检查由对方按资格流程处理。']],
];
export function buildNeighborhoodContent() {
  return {
    manifest:{id:'aetheria/neighborhood-content',namespace:'neighborhood',version:'0.2.0',schemaVersion:1,engineApiVersion:'0.1',author:'Authored neighborhood starter content',status:'reviewed',dependencies:[{id:'aetheria/world',version:'0.1.0',optional:false},{id:'aetheria/reshaping',version:'0.1.0',optional:false},{id:'aetheria/social',version:'0.1.0',optional:false}],requiresCapabilities:['npc.fixed.v1','body.graph.v1','district.v1'],migrations:[]},
    variables:[],flags:[],hooks:[],locations:[],routes:[],actions:[],events:[],texts:{},contributions:[],
    residentTemplates:occupations.map(([key,profession,behavior,names,personality,speech],i)=>({id:`neighborhood:resident.${key}`,locationIds:['aetheria:location.street'],start:480,end:1080,names,profession,appearance:['携带与职业相符的日常用品'],personality,behavior,speciesId:'aetheria-social:species.person',ageYears:24+i*2,bodyTemplateId:'aetheria-tf:body.human',patchIds:i%3===1?['aetheria-tf:patch.ears.cat']:[],dialogue:{intro:speech[0],repeat:speech[1],help:speech[2]}})),
  };
}
