export const FIVE_THEMES=['modern','cyberpunk','fantasy','xianxia','post-apocalypse'];
export const THEME_NAMES={modern:'现代都市',cyberpunk:'赛博都市',fantasy:'中世纪异世界',xianxia:'仙侠世界','post-apocalypse':'废土世界'};
const areas={
 modern:{home:'住宅的公共生活区',market:'街边商店的营业区',workshop:'维修作业区',clinic:'医护接待区',commons:'街道与公共通道'},
 cyberpunk:{home:'居住层的公共区',market:'街区交易与配送区',workshop:'设备维护区',clinic:'街区护理站',commons:'连廊与公共通道'},
 fantasy:{home:'住舍的公共生活区',market:'集市与沿街铺面',workshop:'手工作坊',clinic:'草药护理处',commons:'庭院与公共通道'},
 xianxia:{home:'院落与客舍',market:'坊市的交易区',workshop:'营造与铸器作坊',clinic:'药圃与医馆',commons:'山门附近的公共通道'},
 'post-apocalypse':{home:'避难所的居住区',market:'易物与物资分配区',workshop:'回收修理棚',clinic:'营地护理处',commons:'掩体的公共通道'},
};
export function timeWindow(text){
 if(/晨曦|晨光|晨霜|晨雾|晨气|清晨|日出/.test(text))return {start:360,end:600};
 if(/午后/.test(text))return {start:720,end:1080};
 if(/正午/.test(text))return {start:660,end:840};
 if(/入夜|夜间|夏夜|月华|月光|星光|夜色/.test(text))return {start:1200,end:360};
 if(/夕照|夕阳|日落|晚霞|傍晚|天际斜照|暖色余辉/.test(text))return {start:1020,end:1200};
 if(/日光|阳光|太阳|晒暖/.test(text))return {start:360,end:1080};
 return undefined;
}
export function allowedEcologies(text){
 // Do not confuse battery deposits ("白霜") with an outdoor frost climate.
 if(/覆雪|晨霜|霜面|日出融霜/.test(text))return ['frost'];
 if(/沙尘|细沙颗粒|地表辐射.*炎热/.test(text))return ['dry','forge'];
 if(/雨后|太阳雨|细雨|夹雨|夹着雨|酸雨水珠|雨水倒灌/.test(text))return ['wet','tidal','garden'];
 if(/晨雾|晨光.*薄雾|潮湿薄雾|山谷晨雾|山间云雾/.test(text))return ['wet','tidal','garden'];
 if(/夏夜虫鸣/.test(text))return ['wet','dry','garden','tidal'];
 return undefined;
}
export function sceneService(e){
 // Reception and identity checks are also ordinary clinic waiting-area scenery.
 if(['word.form.cyberpunk.holo-receptionist','word.prop.cyberpunk.peeling-queue-display','word.prop.cyberpunk.identity-card'].includes(e.id))return 'clinic';
 const s=e.text+' '+e.id+' '+e.tagIds.join(' ');
 if(/药|医护|护理|敷料|消毒|first-aid|medicine|thermometer|carer/.test(s))return 'clinic';
 if(/电工|维修|金工|木工|缝纫|漆工|锻|扁锉|钢锉|修理|机械|万用表|配电|线缆|机柜|机油|设备|工具|充电|蓄电|滤芯|滤网|电池|电源|接线|通风|machine|repair|mechanic|electrician|carpenter|tailor|screwdriver|work-gloves|pliers|metalworker/.test(s))return 'workshop';
 if(/收据|单据|收银|柜台|称量|交易|售货|烘焙|饮品|配给|货单|包裹|打印|队|叫号|账|食|餐|锅|厨|茶席|barista|baker|vendor|cashier|queue|receipt|parcel/.test(s))return 'market';
 if(/住户|宿舍|室友|合住|家居|信箱|家用|厨房|饭盒|毛巾|毯|床|枕|雨衣|日历|晾晒|洗衣|休息|坐歇|小憩|housemate|resident|calendar|towel|blanket|cushion|lunchbox|hanger/.test(s))return 'home';
 return 'commons';
}
export function sceneryRecipe(e,theme){
 const service=sceneService(e),pool=e.poolIds[0];
 const prefix=pool==='environment.prop'?'你看见':pool.startsWith('environment.sense.')?'你察觉到':pool==='actor.form'?'你留意到':'你看到一位当地居民的动作：';
 const window=timeWindow(e.text)??(/\.(blinds-stripes|stained-glass-pool|bamboo-dappled-pool|shaft-light-pool)$/.test(e.id)?{start:360,end:1080}:undefined);
 const ecologies=allowedEcologies(e.text);
 return {id:e.id,service,theme,priority:e.priority,context:`你留意着${areas[theme][service]}的日常景象`,fragments:[prefix,e.text,'。'],entryIds:[e.id],
  ...(window?{timeWindow:window}:{}),
  ...(ecologies?{allowedEcologies:ecologies}:{}),
  scope:'generated-incidental-scenery-only',assertedCaption:e.text,
  semanticRequirements:[...e.pendingFacts],
  semanticKey:e.id==='word.prop.xianxia.jade-hairpin-clip'?'bamboo-page-clip':e.id==='word.prop.cyberpunk.leaking-battery'?'frosted-battery-terminal':e.id};
}
