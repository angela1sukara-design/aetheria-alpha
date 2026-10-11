import {readFile,writeFile,mkdir} from 'node:fs/promises';
const id=s=>`district:${s}`, loc=s=>s.includes(':')?s:id('location.'+s);
const bases=['core','world','reshaping','social','recovery'];
const base=await Promise.all(bases.map(async n=>JSON.parse(await readFile(`content/${n}/pack.json`,'utf8'))));
const p={manifest:{id:'aetheria/district',namespace:'district',version:'0.2.0',schemaVersion:1,engineApiVersion:'0.1',author:'GPT · PROPOSED 街区试运行内容',status:'draft',dependencies:base.map(p=>({id:p.manifest.id,version:p.manifest.version,optional:false})),requiresCapabilities:['condition.v1','effect.v1','event.choice.v1','hook.action.v1','npc.fixed.v1','body.graph.v1','tf.pipeline.v1','district.v1'],migrations:[]},variables:[],flags:[],hooks:[],locations:[],routes:[],actions:[],events:[],texts:{},contributions:[],storylets:[],residentTemplates:[],enemies:[],interactions:[],textSlots:[],sceneTexts:[],equipment:[]};
const text=(key,s)=>{p.texts[id('text.'+key)]=s;return id('text.'+key);};
const hook=key=>{const h=id('hook.'+key);p.hooks.push({id:h,accepts:'action',visibility:'public'});return h;};
const add=(h,a)=>{let c=p.contributions.find(c=>c.hookId===h);if(!c)p.contributions.push(c={hookId:h,actionIds:[]});c.actionIds.push(a);};
const flag=(key)=>{const i=id('flag.'+key);if(!p.flags.some(f=>f.id===i))p.flags.push({id:i,initial:false});return i;};
const has=(key,value=true)=>({op:'flag.has',id:flag(key),value});
const set=(key,value=true)=>({op:'flag.set',id:flag(key),value});
const change=(key,amount)=>({op:'var.change',id:`core:${key}`,amount});
const time=minutes=>({op:'clock.advance',minutes});
const body=(key)=>({op:'body.hasCapability',capability:key,count:1});
const action=(key,label,prose,effects,conditions=[],h=null,context=null,group='daily')=>{const a={id:id('action.'+key),label,hint:'选择会推进经历 · 查看行动反馈',group,conditions,effects,resultText:text(key,prose)};if(context)a.context=context;if(h)add(h,a.id);p.actions.push(a);return a.id;};
const hooks=new Map(base.flatMap(p=>p.locations.map(l=>[l.id,l.actionHook])));
const places=[
 ['cafe','雨棚茶馆','雨声与热茶 · 休息、夜间社交',16,24,'茶壶的水声盖过街道上的电流。这里允许你只点一杯水坐到雨停；夜班人把未说完的话留在桌角。','天亮时，杯底倒映着拉起的卷帘。店员开始为早班准备热水。','夜班的收据压在糖罐下。有人等搭档下工，也有人只需要一张安静的椅子。'],
 ['workshop','回声机械工坊','修理台与油灯 · 机械工作、莱克',88,65,'驱动轴在台钳里缓慢旋转。墙上挂着旧义肢，每一件都贴着归还给原主的日期。这里修理的是生活的工具。','莱克把磨损零件一件件排开，白天的委托按紧急程度等候。','工坊夜间只保留一盏值班灯。借用台旁的安全椅一直可供休息。'],
 ['canal','旧渠步道','水位线下 · 探索与风险',60,89,'步道下的黑水映着远处城区。维护牌上写着水位与巡查时间，侧门后隐约有失灵机械的碰撞声。','白天的巡查员在栏杆上补漆，行人沿干燥的内侧通过。','警示灯把积水染成深红。无人接管的搬运机沿着旧轨道继续工作。'],
 ['archive','街区档案室','纸张与旧终端 · 调查、公共工作',15,68,'矮柜里装着修缮图、招工单和居民留下的投诉。值班员把公开材料放在最外层，私人病历不在这里。','公开终端逐个启动。你可以核对记录、整理档案或找出任务中的地点。','夜间自助窗口仍能查询公开记录。封存柜的锁保持关闭。'],
 ['station','下城检查站','秩序与通行 · 风险报告',40,48,'守卫核验货物与身份，旁边留着供受伤者坐下的长凳。登记窗口记录道路危险；机械身体同样使用居民通道。','早班货车排成短队。路况栏上贴着今日能正常通行的街道。','值班守卫收起例行盘问。夜间窗口优先处理求助和道路事故。']
];
for(const [key,name,subtitle,x,y,desc,day,night]of places){const h=hook(key);hooks.set(loc(key),h);p.locations.push({id:loc(key),name,subtitle,textKey:text('location.'+key,desc),actionHook:h,map:{x,y}});for(const [variant,start,end,t]of [['day',360,1080,day],['night',1080,360,night]])p.sceneTexts.push({id:id('scene.'+key+'.'+variant),locationId:loc(key),conditions:[{op:'time.window',start,end}],priority:1,textKey:text('scene.'+key+'.'+variant,t)});}
const street='aetheria:location.street',market='aetheria:location.market',apt='aetheria:location.apartment',clinic='aetheria-tf:location.clinic',salon='aetheria-social:location.salon';
function route(from,to,key){const r=id('route.'+key);p.routes.push({id:r,from,to});action('travel.'+key,'前往'+[...base.flatMap(p=>p.locations),...p.locations].find(l=>l.id===to).name,'你沿着有灯的道路抵达目的地。', [time(10),{op:'location.move',routeId:r}],[],hooks.get(from),null,'travel');}
for(const [key,anchor]of [['cafe',street],['workshop',market],['canal',loc('workshop')],['archive',street],['station',loc('canal')]]){route(anchor,loc(key),key+'.out');route(loc(key),anchor,key+'.back');}
route(loc('station'),street,'station.street');route(street,loc('station'),'street.station');route(loc('archive'),clinic,'archive.clinic');route(clinic,loc('archive'),'clinic.archive');
const runtime=hook('runtime');
for(const [l,h]of hooks){
 action('observe.'+l.split(':')[1],'留意街区与附近的人','你放慢脚步，让街区的日常进入视野。',[time(10),{op:'world.encounter'}],[],h,null,'explore');
 action('resident.talk.'+l.split(':')[1],'与附近路人交谈','你先询问对方是否方便。',[time(5),{op:'resident.talk'}],[{op:'resident.available'}],h);
 action('resident.help.'+l.split(':')[1],'协助这位街坊','你和对方一起处理眼前的小事。',[{op:'resident.help'},time(20)],[{op:'resident.available'}],h);
 if(![apt,market,salon,clinic].includes(l))action('rest.'+l.split(':')[1],'找个安全位置歇息','你坐在公共休息位，等呼吸平稳。城市没有催你立刻赶路。',[time(30),change('energy',15)],[],h);
}
action('create','签下租约，开始生活','城市在窗外醒来。',[{op:'player.create',name:'旅人',ageYears:25}],[{op:'player.created',value:false}],hooks.get(apt));
action('cafe.tea','喝茶，听听店里的近况','热茶把寒意驱散。店员告诉你：工坊缺帮手，档案室也在招人整理公共记录。',[change('money',-2),change('energy',20),time(30)],[],hooks.get(loc('cafe')));
action('archive.work','整理公共档案','你把雨损的门牌记录重新排序。一张张纸背后都是有人住着的家；值班员核对后付清工钱。',[change('energy',-10),time(90),change('money',14)],[],hooks.get(loc('archive')));
action('workshop.work','帮工坊整理零件','你按型号分好轴套，给危险零件贴上红签。莱克检查了工作台，让你收好当天的工钱。',[change('energy',-15),time(90),change('money',18)],[{op:'time.window',start:480,end:1200},body('grasp')],hooks.get(loc('workshop')));
action('station.report','核对危险路段通报','窗口把你带来的路况登记为公开消息。你知道了几处能安全休息的位置。',[time(15),set('road_report')],[],hooks.get(loc('station')));
for(const [l,h]of hooks)action('waitday.'+l.split(':')[1],'休息到次日同一时刻','你在安全休息区安顿下来。一个游戏日过去，街坊重新开始各自的生活。',[time(1440),change('energy',70)],[],h);
const species=base.find(p=>p.species?.length).species[0].id;
for(const [key,locations,profession,appearance,personality,behavior,patchIds,start,end]of [
 ['vendor',[market,loc('cafe')],'摊贩',['袖口有面粉，兽耳上挂着雨滴','穿着改过尾口的工作围裙'],['爽快，喜欢把账目说清楚','谨慎，会先问你的来意'],'trade',['aetheria-tf:patch.ears.cat'],360,1320],
 ['electrician',[street,loc('workshop'),loc('station')],'维护电工',['提着绝缘工具箱，手套边缘有磨痕','机械尾缠着反光安全带'],['简短直接','温和，解释时很耐心'],'repair',['aetheria-tf:patch.tail.organic'],420,1260],
 ['courier',[loc('canal'),loc('archive'),apt,salon,clinic,loc('cafe')],'夜班信使',['肩上有褪色邮包，狼耳避开风口','靴子沾着旧渠的灰，眼神清醒'],['幽默，但不会打听私人事','寡言，熟了会主动打招呼'],'guide',['aetheria-tf:patch.ears.wolf'],1080,600]])
 p.residentTemplates.push({id:id('resident.'+key),locationIds:locations,start,end,names:key==='vendor'?['阿澄','黎湾','温芦']:key==='electrician'?['岑路','夏砾','季弦']:['洛页','安汐','闻舟'],profession,appearance,personality,behavior,speciesId:species,ageYears:28,bodyTemplateId:'aetheria-tf:body.human',patchIds});
// Compact storylets are distinct situations, with authored branches and lasting facts.
const rows=[
 ['rain',street,'积水中的绝缘线','电线垂在积水上方。维修工还没赶到，一位提菜的居民正准备跨过去。你可以把围栏推到路口，也可以绕去窗口报告。','拦起路口','你架好围栏，居民绕行。维护队接手时向你点头，今后夜路多了一盏可靠的灯。','向窗口报修','登记员记录了准确门牌。道路通报增加了一条绕行消息。',-4,0,'repeat',[],['城市','协助']],
 ['parcel',apt,'错投的包裹','门边放着一只印错楼号的药品箱，封条还完整。楼梯上的老住户说收件人就在隔壁街。','送回值班台','值班台核对后收妥包裹，向你支付了送还的小费。','留下清楚的地址便条','你没有拆箱。晚归的收件人能沿便条找到值班台。',-3,4,'once',[],['生活','身份']],
 ['stove',apt,'楼道里的早餐香','邻居的炉子熄火了，面糊却已经调好。对方苦笑着问你有没有时间帮忙搬到公共厨房。','帮忙搬运','两人分担重量，早餐赶上早班。邻居给你留了一份温热的薄饼。','借出公共厨房的钥匙','你登记借用，让邻居自己安排。楼道里很快又有了食物香。',-3,0,'daily',[],['生活','邻里']],
 ['scale',market,'差半格的秤','摊主和顾客盯着秤盘争论。你发现秤脚卡进砖缝，货物倒没有问题。','把秤放平再核对','争执化成一声笑。摊主把找零一枚枚数清，你也得到协助的报酬。','请市场值班员见证','值班员做了公开核验，双方各自道谢，摊位继续营业。',-2,3,'daily',[],['工作','交易']],
 ['ice',market,'将要融化的冰箱','送货车迟了，临时冰箱里装着诊室的冷藏材料。摊主需要有人帮忙找一张遮阳布。','搭起遮阳棚','材料保住了温度。临时搬运的工钱交到你手上。','联络诊室接货','诊室派人提前来接，摊主不必继续守着发愁。',-5,5,'once',[],['工作','诊疗']],
 ['raincoat',market,'没有尾口的雨衣','一名刚完成改造的顾客摸着新尾巴，试穿的雨衣总会鼓起一块。裁缝请你帮忙量好活动余量。','帮忙测量活动范围','裁缝剪开新的尾口，顾客终于能自然坐下。你学会了留意身体与衣物的适配。','找来样衣作参考','你找出有可调节开口的样衣，避免让顾客反复尴尬地试穿。',-2,2,'once',[],['装备','适配']],
 ['cup',loc('cafe'),'被留在桌上的杯子','店员准备收走一只刻着名字的杯子。纸条说明主人已经搬走，却想让常坐这里的人继续使用。','在杯底写下今天的日期','你留下一句祝愿。茶馆的旧物有了新的故事，精力也随着热水恢复。','把杯子交给店员保管','店员把它放进公共杯架。下一位淋雨的人会收到这份善意。',0,0,'daily',[],['社交','休息']],
 ['nightshift',loc('cafe'),'夜班人的空椅','信使把两份茶摆好，搭档却还没有到。雨越来越密，对方忍不住看向路口。','陪着等一会','搭档最终带着湿透的帽子赶来。你们都松了口气，信使记下这张有人守过的桌子。','帮忙询问路况','窗口确认道路安全。对方终于安心坐下，不再把每一次门响都当成坏消息。',0,0,'daily',[{op:'time.window',start:1080,end:360}],['夜间','社交']],
 ['lamp',loc('workshop'),'旧灯的第二次使用','莱克正在拆一只会偶尔闪烁的灯。整件换新很容易，但原主人希望保留外壳上的刻痕。','帮忙逐个测触点','灯重新亮起，刻痕也完整留下。工坊把细致的工时计入了你的报酬。','整理可用的替换件','你选好兼容的触点，替换清单让下一次修理更快。',-5,5,'daily',[],['机械','工作']],
 ['lever',loc('workshop'),'卡在台下的螺母','小螺母滚进维修台底部。必须稳住一块晃动的支架，同时把它取出来。机械尾的抓握端恰好够得着。','用机械尾稳住支架','尾部给了支架稳定的第三个支点，你腾出抓握资源取回零件。莱克称赞的是操作的分寸。','先给支架加临时楔块','你选择更慢但稳妥的办法，确认固定后才探入维修台。',-2,4,'daily',[body('tailGrip')],['身体能力','机械']],
 ['steps',loc('canal'),'断了一半的踏板','检修踏板在水上摇晃。栏杆后卡着一份防水维护记录；有额外平衡部位能更安全地跨过去。','沿栏杆取回记录','你让重心慢慢转移，取回尚可辨认的记录，维护员因此能补齐当天数据。','用长杆把记录勾过来','你留在干燥一侧，利用工具取回纸袋。两条路径都让记录免于沉底。',-4,4,'once',[body('balance')],['探索','平衡']],
 ['water',loc('canal'),'上涨的水位线','一道新水痕超过昨日刻度。老维护牌上的报警电话已模糊，远处仍有行人在低处通行。','先劝人退到高处','你喊回低处的人，再把现场记下来。日后的巡查会采用新的警戒水位。','核对水位并报告','你把准确刻度送到检查站，通报栏增加临时避让提醒。',-4,0,'daily',[],['风险','调查']],
 ['ledger',loc('archive'),'被撕开的工时记录','同一份公共工时登记少了半页。急着结账的工人说补一张很快，值班员却坚持先找原件。','查找装订残页','你从旧夹层找出残页，工人的工资终于按实际时间登记。值班员付清协查工钱。','登记缺页等待核实','你保留疑点，没有替任何人编数字。下一班会接着处理。',-3,6,'once',[],['调查','经济']],
 ['address',loc('archive'),'改名后的门牌','一位居民拿着旧地址寻找诊室。新门牌和旧地图各有一半信息，需要有人核对街道变更。','核对公开地图','你画出能走通的路线。对方不必在雨中继续绕圈。','陪同走到路口','你把方向说清，再带到能看见诊室招牌的位置。',-2,3,'daily',[],['调查','协助']],
 ['queue',loc('station'),'被误读的通行单','扫描器把一位义体居民的维修凭据识别成货物清单。守卫停下例行检查，愿意听完整说明。','指明凭据编号','窗口更正了记录，没有把身体当成货品。那位居民郑重道谢。','请维修窗口核验','你提供了公开核验渠道，检查顺利完成，队伍继续前进。',-1,0,'daily',[],['身份','机械']],
 ['bench',loc('station'),'长凳上的求助者','一位成年人扶着磨伤的足部坐下。对方有诊室地址，却害怕错过最后一班接驳车。','协助叫接驳车','值班员安排了恢复运输。你看着车辆驶向有灯的诊室。','找值班护理员','护理员先处理擦伤，再安排安全路线。求助者终于不再独自硬撑。',-2,0,'daily',[],['恢复','协助']],
 ['filter',clinic,'发出异响的滤网','候诊区的滤网发出不均匀的声音。工作人员忙着照顾病人，故障本身还没有危险。','帮忙清洁外层滤网','你只处理允许接触的外层，医护确认设备恢复。空气安静下来，你收到协助报酬。','递交故障位置记录','你写清时间与位置，让维护工不必在病人之间反复寻找。',-4,4,'daily',[],['诊疗','工作']],
 ['hearing',clinic,'改造后的第一阵噪声','一个刚换过耳部结构的人捂住耳侧。护士说适应需要时间，可以先把候诊广播调低。','协助调低广播','护士确认后调低音量，候诊者慢慢放松。你记住了变化之后还需要照顾日常生活。','陪对方移到安静座位','你先征得同意，指向远离喇叭的位置。身体变化没有抹掉对方决定距离的权利。',-1,0,'once',[],['TF','适应']],
 ['curtain',salon,'挂歪的窗帘','新送来的窗帘偏短了一截。薇尔维特看看尺寸单，说今天开门前至少得遮住强烈的侧光。','协助重新固定','帘子遮住了刺眼光线，沙龙恢复柔和。她说处理生活细节的人值得信赖。','找出临时遮光布','你提出可撤回的办法，等正确尺寸送来再替换。她把这件事记进值班簿。',-3,2,'once',[{op:'time.window',start:540,end:1080}],['沙龙','生活']],
 ['question',salon,'一张没有签名的咨询单','咨询单只问“变化以后还能回来吗”。薇尔维特没有替陌生人决定答案，而是把可逆与不可逆服务分开写清。','帮忙整理公开说明','你把风险和恢复渠道排在前面。提问的人可以按自己的意愿选择。','留下诊室的公开地址','你补上能继续咨询的路径，没有把匿名的问题当作邀请。',0,0,'daily',[],['边界','TF']],
 ['sign',street,'被风掀起的招工牌','临时招工牌打在路灯上。它写着档案整理与零件搬运两种工作，工资和时长都很清楚。','把招工牌重新固定','你读过工时与报酬，把它固定在行人能看见的位置。街区工作线索已记下。','向值班台抄一份招工信息','你核对了条件，知道两种工作的实际入口。今天的生活有了下一步。',-1,0,'once',[],['工作','发现']],
 ['tailchair',loc('cafe'),'椅背与新的重心','店里的圆背椅让尾部无处安放。店员推来一把开背椅，愿意听你说哪一种更舒服。','试坐并说明差别','你慢慢调整重心，说明开背的余量。店员把这把椅子留给有相似需要的客人。','改坐长凳','长凳让你自由安排姿态。适应后的身体也需要合适的家具。',0,0,'daily',[body('balance')],['TF','生活反馈']],
 ['scent',market,'风里不同的层次','兽耳捕捉到篷布后的细响。你发现支杆快要滑出固定孔，附近摊主还没注意。','提醒摊主加固篷布','你指出了听见异响的位置，支杆及时加固。身体带来的细微感受有了实际用途。','帮忙把货物移开','你先把人和货物移到安全一侧，再交给专业维护人员。',-3,3,'once',[{op:'body.hasPart',definitionId:'aetheria-tf:part.ear.wolf'}],['兽化','感官']],
 ['ink',loc('archive'),'被墨水遮住的日期','公开维修图上有一块墨渍。日期仍能从下层复印件辨认，仓促猜测则可能找错版本。','逐页对照旧复印件','你找出真实日期，并在旁边注明来源。以后调查这条线路的人能沿记录追溯。','登记疑点，不猜日期','你保留原件，写明缺失的信息。准确的疑点比漂亮的假答案更有价值。',-3,3,'once',[],['隐藏','调查']],
 ['tidebell',loc('canal'),'水下的旧铃','水面下传来一声规律的敲击。它不是呼救，而是旧排水浮标碰在护栏上。夜间很容易被误解。','把浮标固定在标尺旁','规律的噪声停止了，水位标志也更容易辨认。你记下这个不该当成怪谈的声音。','把声音来源报告给巡查员','巡查员确认位置，在夜班记录中补上说明。',-4,4,'once',[{op:'time.window',start:1080,end:360}],['隐藏','夜间']],
 ['oil',loc('workshop'),'不该混装的润滑油','两罐相似的润滑油被放在一起，标签说明其中一种只适用于机械外壳，不能接触有机连接。','重新分柜标识','你按适用材质分开存放。莱克确认无误后计入额外工钱。','请技师复核再动手','你没有靠颜色猜测。技师花了几分钟解释连接处的维护常识。',-3,4,'once',[],['机械','适配']],
 ['gloss',clinic,'黑胶表面的清洁测试','护理台上是一片黑胶共生材料的脱落外层。护士说明它只是样本，接触不会替你做出任何改造决定。','帮忙记录清洁剂的反应','样本保持稳定，你记住了护理顺序与停用征兆。身体仍然由自己的决定支配。','查阅安全的护理说明','你读完可逆处理与复诊条件，把正式咨询留到准备好时。',-2,2,'once',[],['黑胶','诊疗']],
 ['return',apt,'门口多出来的伞','公共伞架多了一把补过的伞。纸条说谁需要就借走，只要回来时把水抖干。','登记借用再归还','你走过一段有雨的楼道又把伞归位。记录上多了你的名字，公用物品没有少。','修好松动的伞架','你把螺丝拧紧，让每一把借来的伞都有地方放。',-1,0,'daily',[],['邻里','生活']],
 ['dawn',loc('station'),'第一班清洁车','清洁车准备进入步道，司机需要知道昨夜留下的围栏有没有解除。通报板与现场记录互相印证。','协助核对现场记录','司机按仍有效的封路标记绕行。早班没有撞进夜班留下的危险。','请值班守卫确认','守卫核实后签名，让工作交接清楚地完成。',-2,3,'daily',[{op:'time.window',start:300,end:600}],['跨日','工作']]
];
function event(key,title,prose,choices,participants=[]){const e={id:id('event.'+key),startNode:'start',nodes:[],...(participants.length?{participantIds:participants}:{})};const start={id:'start',type:'choice',textVariants:[text('event.'+key+'.start',title+'\n\n'+prose)],actionIds:[],onEnter:[]};e.nodes.push(start);for(const [i,ch]of choices.entries()){const [label,tx,fx=[],conditions=[]]=ch;const end='end'+i;const aid=action('event.'+key+'.'+i,label,tx,[...fx,{op:'event.advance',nodeId:end}],conditions,null,{eventId:e.id,nodeId:'start'},'event');start.actionIds.push(aid);e.nodes.push({id:end,type:'exit',textVariants:[text('event.'+key+'.'+end,tx)],actionIds:[],onEnter:[{op:'event.exit'}]});}p.events.push(e);return e.id;}
for(const [key,l,title,prose,a,at,b,bt,energy,money,repeat,conditions,tags]of rows){const effects=[change('energy',energy),change('money',money),time(15),set('story.'+key)];const eid=event(key,title,prose,[[a,at,effects],[b,bt,[time(10),set('story.'+key+'.alternative')]],['暂时离开','你记下眼前的情况，回到街区。',[time(2)]]]);p.storylets.push({id:id('storylet.'+key),locationId:l,conditions,eventId:eid,weight:10,priority:1,cooldownMinutes:120,cooldownGroup:'streetlife.'+key,repeat,hidden:tags.includes('隐藏'),tags});}
const lostEvent=event('lostpass','路灯下的证件夹','一只证件夹卡在路灯底座旁。封面留着公用失物台的编号；你不需要翻看私人资料，也能把它交到正确的地方。',[
 ['送交失物台','值班员按封面编号登记，你拿到一张可追踪的交接回执。',[time(15),set('lostpass.returned'),change('money',2)]],
 ['请附近守卫收妥','你请守卫当面记录拾取位置，然后继续自己的路。',[time(5),set('lostpass.witnessed')]],
 ['留在原处并记下位置','你暂不接触证件，回到街道。',[time(2)]]]);
p.storylets.push({id:id('storylet.lostpass'),locationId:street,conditions:[],eventId:lostEvent,weight:10,priority:1,cooldownMinutes:120,cooldownGroup:'streetlife.lostpass',repeat:'once',hidden:false,tags:['身份','失物']});
await mkdir('content/district',{recursive:true});await writeFile('content/district/pack.json',JSON.stringify(p,null,2));
const index=JSON.parse(await readFile('content/index.json','utf8'));if(!index.packs.includes('./district/pack.json'))index.packs.push('./district/pack.json');await writeFile('content/index.json',JSON.stringify(index,null,2));
