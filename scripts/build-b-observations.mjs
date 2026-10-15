import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {proseProblem} from '../src/content/player-prose.ts';

const sourceFile='content/prose/b-authoring-v2.json';
const planFile='production/text-slot-integration/b-observations-v1.json';
const outputFile='src/world/b-observation-data.ts';
const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const read=async file=>JSON.parse(await readFile(file,'utf8'));
const source=await read(sourceFile);
const entries=source.deliveries.flatMap(d=>d.entries),byId=new Map(entries.map(e=>[e.id,e]));
if(entries.length!==270||byId.size!==270)throw Error('B content must contain exactly 270 unique source entries.');
const word=(prefix,suffix)=>prefix+suffix;
const prop='word.prop.modern.',sense='word.sense.modern.',form='word.form.modern.',action='word.action.modern.';
const part='word.bodypart.common.',body='word.bodymaterial.common.',bodyQ='word.bodymatqual.common.';
const material='word.material.common.',materialQ='word.materialqualifier.common.';
const plans=[];
function add(id,service,context,tokens,modern=true){
  if(!byId.has(id))throw Error('Missing source '+id);
  const refs=tokens.filter(t=>typeof t==='object').map(t=>t.entryId);
  if(!refs.includes(id))throw Error('Primary lexeme missing from recipe '+id);
  const sourceHashes=Object.fromEntries([...new Set(refs)].map(ref=>{if(!byId.has(ref))throw Error('Unknown recipe source '+ref);return[ref,sha(byId.get(ref))];}));
  plans.push({id,service,theme:modern?'modern':'generic',context,tokens,sourceHashes});
}
const entry=entryId=>({entryId});
// These are bounded editorial scene recipes, not a cross product of arbitrary slots.
// Their incidental people/objects are generated scenery, never player/NPC body facts.
const props={
 'takeout.pile':['home','公寓门厅外'], 'store.vending':['market','便利店门口'],
 'station.turnstile':['commons','街区交通站的入口'], 'locker.parcel':['home','住宅的取件区'],
 'shelf.noodles':['market','便利店货架之间'], 'corridor.elevator':['home','住宅的电梯厅'],
 'bike.shared':['commons','街边的停车线旁'], 'locker.row':['commons','公共储物区'],
 'mailbox.grid':['home','公寓的信箱区'], 'dispenser.bottle':['commons','公共休息室'],
 'extinguisher.expired':['workshop','维修铺的消防架旁'], 'firstaid.chipped':['clinic','诊所的急救用品区'],
 'washbasin.wet':['commons','公共盥洗区'], 'drain.standing':['commons','路边的排水沟旁'],
 'vent.grill':['workshop','工坊的通风口下'], 'handrail.polished':['home','住宅楼梯间'],
 'clothespin.row':['home','公共晾晒区'], 'towel.damp':['home','住户开放的洗衣区'],
 'bottle.scale':['home','公共茶水间'], 'thermos.dented':['home','公共茶水间'],
 'lunchbox.faded':['home','公共厨房的置物架旁'], 'umbrella.bin':['market','商店的雨伞桶旁'],
 'charger.tangled':['workshop','电子维修台旁'], 'powerbank.labeled':['market','商店的充电柜旁'],
 'transitcard.worn':['commons','交通站的失物招领台旁'], 'receipt.crumpled':['market','便利店收银台旁'],
 'clock.slow':['workshop','维修铺的工作台旁'], 'calendar.stale':['home','公寓值班室'],
 'hanger.twisted':['home','公共晾晒区'], 'sponge.gray':['home','公共厨房的水槽旁'],
 'cloth.striped':['workshop','清洁用品间'], 'wrench.greasy':['workshop','修车铺的工作台旁'],
 'screwdriver.taped':['workshop','电器维修台旁'], 'flashlight.rolling':['workshop','工具柜旁'],
 'tape.halfcut':['market','商店的包装台旁'], 'map.frayed':['commons','街区问讯处'],
 'key.ring':['home','公寓值班室的失物台旁'], 'needle.cuff':['workshop','裁缝铺的试衣区'],
 'arcadecoin.crack':['market','街机店门口'], 'peel.sill':['home','公共厨房的窗边'],
};
for(const [suffix,[service,context]]of Object.entries(props))add(prop+suffix,service,context,['你注意到',entry(prop+suffix),'。']);
const senses={
 'exhaust.peak':['commons','车流经过的街边'], 'ac.outdoor':['home','装着空调外机的住宅楼下'],
 'subway.draft':['commons','地铁站口'], 'window.grid':['home','住宅之间的通道'],
 'oil.kitchen':['market','小吃店的排烟口旁'], 'disinfect.floor':['clinic','刚清洁过的诊所走廊'],
 'gas.range':['home','一处厨房的灶台旁'], 'plastic.new':['market','塑料用品店门口'],
 'asphalt.humid':['commons','雨后仍温热的柏油路边'], 'bin.sour':['market','垃圾收集点旁'],
 'brake.burnt':['commons','刚停过车的路口'], 'shutter.motor':['market','正在升起卷帘门的商店外'],
 'pipe.gurgle':['home','住宅的管道井旁'], 'doorbell.shop':['market','便利店门口'],
 'screen.coldlight':['commons','有人看手机的长椅旁'], 'headlight.sweep':['home','临街窗户旁'],
 'lightbox.warm':['market','亮着店招灯箱的街边'], 'ac.chill':['market','商场的入口'],
 'toner.air':['market','打印店门口'], 'cardboard.dry':['market','纸箱收纳区'],
 'traffic.hiss':['commons','临近马路的人行道'], 'catfood.hall':['home','放着猫食碗的楼道'],
 'static.zap':['home','干燥的楼道里，你的指尖刚碰到金属扶手'],
 'floor.wax':['commons','打过蜡的大厅地板上'], 'fridge.hum':['home','开着冰箱的公共厨房'],
};
for(const [suffix,[service,context]]of Object.entries(senses))add(sense+suffix,service,context,['你察觉到',entry(sense+suffix),'。']);
const actors={
 'rider.mount':['market','商店门口','phone.flick'], 'cashier.drowse':['market','便利店的收银区','clock.double'],
 'guard.pace':['home','住宅的门岗旁','gate.verify'], 'commuter.doze':['commons','交通站的候车区','doze.nod'],
 'cleaner.lean':['commons','公共盥洗区','mop.wring'], 'cook.splatter':['market','小吃店开放的备餐区','wok.toss'],
 'electrician.ladder':['workshop','电器维修铺','belt.order'], 'plumber.kneel':['workshop','水管维修铺','screw.back'],
 'mechanic.crouch':['workshop','修车铺','screw.back'], 'painter.flecked':['workshop','装修工坊','towel.square'],
 'barber.sweep':['market','理发店','towel.square'], 'waiter.weave':['market','餐馆的收银区','receipt.smooth'],
 'student.cram':['market','快餐店','novel.lamp'], 'grandma.cart':['market','街边商店','bargain.point'],
 'office.call':['home','楼道的窗边','call.turn'], 'librarian.cart':['commons','图书室','novel.lamp'],
 'reception.verify':['clinic','诊所接待处','clock.double'], 'sorter.squat':['market','快递分拣区','sort.toss'],
 'gardener.butt':['commons','花坛边','stretch.half'], 'nightshift.wait':['commons','候车区','battery.stare'],
 'rainrider.drip':['market','雨棚下','phone.flick'], 'busker.quiet':['commons','街边的长椅旁','music.nod'],
 'pupil.bag':['commons','放学路上的长椅旁','game.swipe'], 'jogger.breathe':['commons','步道旁','stretch.half'],
 'feeder.pigeon':['commons','公共广场','nod.across'], 'laundry.novel':['home','洗衣房','novel.lamp'],
 'taiji.dawn':['commons','晨练广场','taiji.flow'], 'swim.wethair':['home','住宅的门厅','phone.flick'],
 'mailbox.tiptoe':['home','住宅的信箱区','lock.rattle'], 'window.primp':['market','街边商店','bargain.point'],
};
for(const [suffix,[service,context,act]]of Object.entries(actors)){
  const adjusted=act==='novel.lamp'?context+'外的路灯旁':context;
  add(form+suffix,service,adjusted,[entry(form+suffix),entry(action+act),'。']);
}
const actions={
 'queue.shuffle':['market','商店的结账队伍里','一位顾客'], 'phone.flick':['commons','街边长椅旁','一位路人'],
 'paycode.hold':['market','便利店收银台前','一位顾客'], 'box.seal':['market','快递包装台旁','一位包装员'],
 'mop.wring':['commons','公共盥洗区','一位保洁员'], 'earbud.single':['commons','候车区','一位乘客'],
 'board.scan':['commons','交通站的信息屏前','一位乘客'], 'stand.shift':['commons','候车区的立柱旁','一位乘客'],
 'window.watch':['commons','交通站的玻璃隔墙边','一位乘客'], 'ticket.crease':['commons','交通站的候车区','一位手里拿着车票的乘客'],
 'scan.turn':['market','商店收银台旁','一位店员'], 'wok.toss':['market','小吃店的备餐区','一位厨师'],
 'screw.back':['workshop','修车铺的工具台旁','一位修车师傅'], 'sort.toss':['market','快递分拣区','一位分拣员'],
 'towel.square':['home','公共洗衣房','一位洗衣客'], 'shelf.stuff':['market','便利店的货架旁','一位补货员'],
 'water.climb':['home','住宅楼梯间','一位送水员'], 'belt.order':['workshop','工坊的工具柜旁','一位维修工'],
 'game.swipe':['commons','街边长椅旁','一位拿着手机的路人'], 'music.nod':['commons','公共广场','一位路人'],
 'smoke.stoop':['commons','室外吸烟区','一位路人'], 'stretch.half':['commons','公共广场','一位晨练者'],
 'novel.lamp':['commons','街边路灯旁','一位拿着小说的路人'], 'mirror.check':['commons','路边停着的车旁','一位司机'],
 'gate.verify':['home','住宅门岗旁','一位保安'], 'lock.rattle':['market','商店门口','一位刚锁好门的店主'],
 'call.turn':['commons','街边的安静处','一位路人'], 'earbud.share':['commons','并排坐着两个人的长椅旁','其中一人'],
 'doze.nod':['commons','交通站的候车区','一位乘客'], 'clock.double':['workshop','挂着时钟的工作室','一位戴着手表的维修工'],
 'receipt.smooth':['market','便利店的收银台旁','一位店员'], 'sketch.counter':['market','店里的座位旁','一位手里拿着笔的顾客'],
 'taiji.flow':['commons','播放晨练音乐的广场','一位晨练者'], 'battery.stare':['commons','街边长椅旁','一位拿着手机的路人'],
 'corner.track':['commons','街边','一位路人'], 'photo.squat':['commons','广场的合影区','一位拿着相机的路人'],
 'nod.across':['commons','路口的人行道旁','一位路人'], 'bargain.point':['market','街边摊位前','一位顾客'],
 'dog.wait':['commons','人行道的电线杆旁','一位遛狗的人'], 'kid.shoulder':['commons','广场上','一位带着孩子的家长'],
};
for(const [suffix,[service,context,actor]]of Object.entries(actions))add(action+suffix,service,context,[actor,entry(action+suffix),'。']);
const partContexts={
 'hand.vein':'一位在长椅上休息的路人伸开了手', 'hands.folded':'一位路人坐在桌边',
 'forearm.prop':'一位路人坐在带扶手的椅子上', 'ankle.sway':'一位路人穿着露出脚踝的短裤走过',
 'shoulder.rise':'一位路人停下来调整呼吸', 'throat.bob':'一位路人刚喝下一口水',
 'thumb.callus':'一位修补匠把手放在工具台上', 'ringfinger.mark':'一位路人伸手整理衣袖',
 'fist.clench':'一位路人在活动手指', 'tiger.corn':'一位工匠正在歇手',
 'hand.dangle':'一位路人站在通道旁', 'elbow.sill':'一位路人倚在窗边',
 'wrist.cuff':'一位路人挽起了袖口', 'arms.cross':'一位路人在通道旁抱起双臂',
 'back.straight':'一位路人坐直了身体', 'back.wall':'一位路人靠墙歇脚',
 'chest.breath':'一位路人停下来调整呼吸', 'collarbone.line':'一位路人整理敞开的衣领',
 'waist.tuck':'一位路人侧身让出通道', 'heel.plant':'一位路人站稳了脚步',
 'toes.curl':'一位在休息区脱下鞋袜的旅人活动着脚趾', 'legs.stand':'一位路人站在通道旁',
 'knee.bend':'一位路人坐下弯起了腿', 'calf.hem':'一位路人穿着长裤站在附近',
 'hair.shoulder':'一位留着及肩头发的路人侧过身', 'jaw.set':'一位路人抿了抿嘴',
 'lash.flutter':'一位路人眨了眨眼', 'nape.expose':'一位束起头发的路人低下头',
 'hair.nape':'一位路人抬手整理头发', 'earlobe.pierced':'一位路人侧头听人说话',
 'nose.red':'一位刚从寒冷处过来的路人停下来回暖', 'hand.yawn':'一位路人抬手掩住哈欠',
 'foot.heeldrag':'一位路人松开鞋带，踩下了鞋后帮', 'index.gesture':'一位路人抬手指路',
 'hands.headrest':'一位路人在长椅上向后舒展身体', 'legs.barswing':'一位路人坐在高凳上晃着腿',
 'knee.dusty':'一位路人的短裤膝部露在外面', 'hand.sleeve':'一位路人拉长了衣袖',
 'knuckle.page':'一位路人在桌边整理纸张', 'eyecorner.crease':'一位路人朝同伴笑了笑',
};
for(const [suffix,context]of Object.entries(partContexts))add(part+suffix,'commons',context,['你留意到对方',entry(part+suffix),'。'],false);
const bodyScenes={
 skin:['一位路人挽起衣袖','手腕上的'],pelt:['一只小猫伏在窗台上','耳边的'],
 hair:['一位长发路人靠在长椅边','垂在肩头的'],fuzz:['一位路人挽起衣袖','小臂上的'],
 keratin:['一位路人脱下鞋袜休息','脚跟边的'],nail:['一位路人伸手整理东西','指尖的'],
 scale:['一只壁虎停在石墙上','背部的'],carapace:['一只小螃蟹沿石缝移动','背部的'],
 feather:['一只鸟停在屋檐上','翼边的'],callus:['一位工匠摊开手掌歇息','掌心的'],
 membrane:['一只壁虎在石墙上舒展前肢','关节边的'],scar:['一位路人挽起衣袖','小臂上的'],
 clawtip:['一只猫伸开前爪','前爪上的'],scab:['一位路人露出了擦伤正在愈合的手肘','手肘上的'],
 wisp:['一只幼猫伏在窗台上','耳边的'],
};
for(const [suffix,[context,prefix]]of Object.entries(bodyScenes))add(body+suffix,'commons',context,[context.startsWith('一只')?'你留意到它':'你留意到对方',prefix,entry(body+suffix),'。'],false);
const bodyModifiers={
 warmth:['skin','一位刚在暖处歇息过的路人挽起衣袖'],coarse:['callus','一位工匠摊开手掌'],
 soft:['wisp','一只幼猫伏在窗台上'],taut:['skin','一位路人伸直了手指'],damp:['pelt','一只刚淋过雨的小猫伏在窗台上'],
 loose:['skin','一位路人放松了手掌'],dryskin:['skin','一位路人的手背因干燥而起皮'],dense:['pelt','一只毛茸茸的小猫伏在窗台上'],
 sparse:['hair','一位头发稀疏的路人摘下帽子'], 'glossy.oil':['skin','一位路人的额头带着油光'],
 matted:['hair','一位头发湿后打绺的路人靠在通道旁'],smooth:['nail','一位路人伸手整理东西'],
 sleek:['hair','一位刚梳过头发的路人站在附近'],messy:['hair','一位头发被风吹乱的路人站在附近'],
 supple:['membrane','一只壁虎舒展前肢'],callused:['skin','一位工匠摊开手掌'],
 'matte.skin':['nail','一位路人伸出没有抛光的指甲'], 'hard.keratin':['carapace','一只小螃蟹沿石缝移动'],
 'translucent.skin':['membrane','一只壁虎停在透光的叶片旁'],striated:['scale','一只壁虎停在石墙上'],
 cool:['skin','一位刚从凉处过来的路人伸出手'], 'damp.sweat':['skin','一位刚跑完步的路人擦拭额头'],
 goosebump:['skin','一位受凉的路人挽起衣袖'], 'dusty.skin':['skin','一位刚搬过积灰箱子的路人摊开手'],
 freckled:['skin','一位手臂有雀斑的路人挽起衣袖'],bruised:['skin','一位手臂带着淤青的路人整理衣袖'],
 windsore:['skin','一位脸颊被冷风吹皴的路人停下来回暖'],wrinkle:['skin','一位路人屈起手指'],
 scarpull:['skin','一位小臂留着旧疤的路人伸展手臂'],waxslick:['carapace','一只甲壳光亮的小螃蟹沿石缝移动'],
};
for(const [suffix,[main,context]]of Object.entries(bodyModifiers))add(bodyQ+suffix,'commons',context,[context.startsWith('一只')?'你留意到它身上':'你留意到对方身上',entry(bodyQ+suffix),'的',entry(body+main),'。'],false);
const materials={
 water:['commons','饮水处','杯里的'],machineoil:['workshop','修车铺的接油盘旁','盘里的'],
 dust:['home','储物间的架子旁','架子上的'], 'detergent.liquid':['home','公共厨房的清洁台旁','瓶里的'],
 'disinfect.liquid':['clinic','诊所的清洁台旁','瓶里的'], 'grease.lub':['workshop','维修台旁','盒里的'],
 condensate:['home','有冷凝水积存的冷藏柜旁','托盘里的'],mud:['commons','刚下过雨的土路旁','路边的'],
 rust:['workshop','旧铁件清理台旁','清理下来的'],rainwater:['commons','雨后的街边','桶里接到的'],
 grime:['workshop','维修台的清洁区','盘里刮下来的'], 'glass.shards':['workshop','玻璃维修铺的回收区','回收盒里的'],
 'coffee.stain':['market','咖啡店的空桌旁','桌上的'], 'wax.floor':['commons','大厅的清洁用品架旁','罐里的'],
 mortar:['workshop','泥瓦工的拌料台旁','桶里的'], 'tea.stain':['home','公共茶水间','杯壁上的'],
 powder:['workshop','开启除尘设施的加工间','集尘盘里的'],distilled:['clinic','诊所的用品柜旁','瓶里的'],
 'salt.melt':['commons','冬季道路维护的物料架旁','袋里的'],correction:['commons','书写用品台旁','瓶里的'],
};
const modernMaterials=new Set(['machineoil','detergent.liquid','disinfect.liquid','grease.lub','condensate','wax.floor','distilled','salt.melt','correction']);
for(const [suffix,[service,context,prefix]]of Object.entries(materials))add(material+suffix,service,context,['你注意到',prefix,entry(material+suffix),'。'],modernMaterials.has(suffix));
const materialModifiers={
 turbid:['water','有泥沙沉降的水杯旁'],clear:['distilled','放着蒸馏水瓶的台面旁'],
 viscous:['machineoil','放着机油盘的维修台旁'],scalding:['water','刚烧好水的茶水台旁'],
 crusted:['grime','积着干硬油垢的清洁盘旁'],cold:['water','放着冷水杯的茶水台旁'],
 lukewarm:['water','放着温水杯的茶水台旁'], 'thin.diluted':['machineoil','放着低黏度机油的维修台旁'],
 filtered:['water','已完成过滤、单独盛放清水的饮水台旁'],congealed:['wax.floor','存放已经凝固地板蜡的清洁台旁'],
 frothy:['detergent.liquid','刚搅动过清洁液的水槽旁'],bubbling:['mud','气泡正在冒出的泥水坑旁'],
 seeping:['mud','刚取出的含水泥浆旁'],rusted:['rust','旧铁件的除锈台旁'],
 moldy:['grime','存放发霉油垢的废弃清洁盘旁'],dried:['mortar','存放干燥灰浆碎块的回收区'],
 'dusty.mat':['wax.floor','一块表面落了灰的凝固地板蜡旁'], 'greasy.mat':['mud','一处混入油脂的泥浆坑旁'],
 soaked:['dust','刚被水浸湿的积灰旁'],frozen:['rainwater','寒冷天气里结冰的接雨桶旁'],
 sticky:['grease.lub','润滑脂收纳盒旁'],layered:['machineoil','一盘油水分层的废机油旁'],
 iridescent:['water','一洼表面浮着彩色油膜的积水旁'],sparkling:['glass.shards','透光的玻璃回收盒旁'],
 faded:['correction','存放颜色已褪去的有色修正液旁'],embedded:['wax.floor','嵌着碎屑的凝固地板蜡旁'],
 etched:['glass.shards','回收带有蚀痕碎玻璃的工具台旁'],staticcling:['wax.floor','表面吸附纸屑的凝固地板蜡旁'],
 'bubble.fine':['water','盛着细密气泡尚未散尽清水的杯子旁'], 'metal.fleck':['machineoil','放着混有金属屑的废机油盘旁'],
};
for(const [suffix,[main,context]]of Object.entries(materialModifiers)){
  const [service]=materials[main];
  add(materialQ+suffix,service,context,['你注意到',entry(materialQ+suffix),'的',entry(material+main),'。'],modernMaterials.has(main));
}
if(plans.length!==270||new Set(plans.map(p=>p.id)).size!==270)throw Error('Each source entry needs exactly one reviewed primary recipe.');
if(process.argv.includes('--install')){
  await mkdir('production/text-slot-integration',{recursive:true});
  await writeFile(planFile,JSON.stringify({format:'aetheria-reviewed-observation-recipes',version:1,reviewDate:'2026-10-15',sourceHash:sha(source),scope:'generated-incidental-scenery-only',recipes:plans},null,2)+'\n');
}
const plan=await read(planFile);
if(plan.sourceHash!==sha(source))throw Error('Authoring text changed; observation adaptations require review.');
if(JSON.stringify(plan.recipes)!==JSON.stringify(plans))throw Error('Recipe changes require explicit installation review.');
const rendered=plan.recipes.map(p=>{
  for(const [id,hash]of Object.entries(p.sourceHashes))if(sha(byId.get(id))!==hash)throw Error('Unreviewed source '+id);
  const fragments=p.tokens.map(t=>typeof t==='string'?t:byId.get(t.entryId).text);
  const body=p.context+'。'+fragments.join('');
  if(proseProblem(body)||body.includes('的的')||body.includes('undefined'))throw Error('Invalid observation '+p.id);
  return {id:p.id,service:p.service,theme:p.theme,context:p.context,fragments,entryIds:[...new Set(p.tokens.filter(t=>typeof t==='object').map(t=>t.entryId))]};
});
await writeFile(outputFile,'// Generated from fingerprinted, reviewed scene recipes. Do not edit directly.\nexport const B_OBSERVATIONS = '+JSON.stringify(rendered,null,2)+' as const;\n');
console.log(JSON.stringify({entries:entries.length,reviewedRecipes:rendered.length,modern:rendered.filter(r=>r.theme==='modern').length,generic:rendered.filter(r=>r.theme==='generic').length,output:outputFile}));
