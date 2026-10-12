import { catalog } from './catalog.mjs';
import { createTaxonomy } from './general-tag-taxonomy.mjs';
const worldLibraries=['world-terrain','world-building','world-room','world-district','world-nature','world-weather','world-culture','world-workplace','world-object','world-facility','world-detail','world-scent','world-sound','text-environment'];
const bodyLibraries=catalog.filter(c=>c.group==='body').map(c=>c.code);

/** 只从字面提取素材主题。上下文、属性和对象分域，不替代游戏条件。 */
export function expandedTaxonomy(seeds) {
  const t=createTaxonomy(catalog);t.version='1.1.0';t.format='aetheria-general-expanded-taxonomy';
  const known=new Map(t.concepts.map(c=>[c.id,c]));
  function term(key,label,aliases,facet='world-object',role='core',libraries=worldLibraries) {
    const existing=t.concepts.find(c=>c.label===label&&c.role===role&&c.facet===facet);
    if(existing){t.rules.push({id:`expanded:${key}`,conceptId:existing.id,libraries,expression:aliases,source:'literal-span'});return;}
    const id=`general-taxonomy:expanded.${key}`;
    if(known.has(id))throw Error(`Duplicate taxonomy ID: ${id}`);
    const def={id,label,role,facet,definition:`${label}这一独立素材主题或描述维度；不证明角色属性、设备状态或环境参数。`,status:'proposed-editorial'};
    t.concepts.push(def);known.set(id,def);t.rules.push({id:`expanded:${key}`,conceptId:id,libraries,expression:aliases,source:'literal-span'});
  }
  const heads=`
street|街道|雨街|街道|巷道|街区
alley|巷|巷|胡同
floor|楼层|楼层
podium|裙楼|裙楼
atrium|中庭|中庭
bridge|桥|天桥|断桥|吊桥|廊桥|栈桥|桥面|云桥|雪桥|铁桥|浮桥|拱桥
wall|墙|墙|围墙
gate|门|气闸门|闸门|城门|舱门|院门|门扇
tower|塔|塔|哨塔
palace|宫殿|宫殿|宫室
temple|庙宇|寺庙|庙宇|神庙
castle|城堡|城堡|古堡|堡垒
corridor|通道|通道|隧道|回廊|长廊
walkway|栈道|栈道|检修道
stair|楼梯|楼梯|石阶|梯段
window|窗|观察窗|舷窗|窗格|窗纸|窗台
airlock|气闸|气闸
canopy|篷|布篷|遮雨篷|雨篷
canal|水渠|水渠|排水渠|灌渠
ditch|沟|缆沟|排水沟|冲蚀沟|水沟
pit|坑|弹坑|酸蚀坑|矿坑
shore|滩|河滩|卵石滩|泥滩|沙滩|浅滩
riverbed|河床|河床
valley|谷|峡谷|河谷
cave|洞穴|洞穴|洞窟|石洞
desert|沙漠|沙漠|戈壁|沙丘
icefield|冰原|冰原|雪原|海冰
forest|林地|雨林|丛林|树林|林地
swamp|沼泽|沼泽|湿地
lava|熔岩|熔岩|岩浆
volcano|火山|火山
spring|泉|热泉|灵泉|泉池|泉眼
rock|岩石|玄武|碎石|岩石
salt-crust|盐壳|盐壳
island|岛|浮岛|岛缘|海岛
harbor|港口|云港|港口|港湾
dock|船坞|船坞
mooring|系泊设施|缆桩|系泊
cargo-hold|货舱|货舱
ship|船舶|船舶|船体|飞艇
engine|发动机|发动机|引擎
pump|泵|泵站|水泵|泵房
generator|发电机|发电机
pipe|管路|管网|管路|管道|风管
valve|阀门|阀门|阀廊|调压阀
cable|线缆|线缆|电缆|缆线
filter|滤芯|滤芯
antenna|天线|天线
radio|电台|电台
relay|继电器|继电器
pressure-gauge|压力表|压力表|舱压表
sign|标识|标识|路牌|警戒牌|剂量牌|告示牌
warning-post|警戒桩|警戒桩
screen|显示屏|广告屏|显示屏|屏幕
lighting-strip|灯带|灯带|灯环
rail-transit|轨道交通|空轨|地铁
platform|站台|换乘栈|站台
laboratory|实验室|实验室|研究室
cultivation-tank|培养槽|培养槽|培养池
hydroponics|水培设施|水培舱|水培架|水培廊
bed|床|床榻|卧榻|床铺
table|桌|桌|工作台|操作台|滤芯台
chair|椅|椅|板凳
cabinet|柜|柜|柜架
shelf|架|书架|货架|图纸架|工具架
tray|托盘|托盘
curtain|帘|门帘|布帘|隔帘
fence|围栏|围栏|铁丝网
rope|绳|拉索|缆绳|绳结
water-tank|水箱|水箱|水塔
bell|铃|风铃|铃声
rooftile|瓦|灰瓦|瓦片
protective-cover|防护罩|防护罩|隔音罩
ventilation-duct|风道|风道|通风井
service-desk|服务台|柜台|服务台|接待台
sewer|下水道|下水道|排污口
drain-cover|沟盖|盖板|沟盖
roadblock|路障|路障
grave|墓穴|墓穴|墓室|墓道
cell|牢房|牢房|囚室
saloon|酒馆|酒馆|酒吧
school|学校|校园|学校|学堂
hospital|医院|医院
factory|工厂|工厂|厂区
railway|铁路|铁轨|铁路
ballast|道碴|道碴
greenery|植物|绿叶|植物|叶片
seagrass|海草|海草
coral|珊瑚|珊瑚
stalactite|钟乳石|钟乳石|钟乳
stalagmite|石笋|石笋
hot-spring-steam|蒸汽|蒸汽|汽雾
crack|裂缝|裂痕|裂纹|裂隙
water-mark|水痕|水痕|水线
wear-mark|磨损痕迹|磨损|刮痕|擦痕
footprint|脚印|脚印|足迹
growth-mark|生长痕迹|青苔|嫩叶|新芽
`;
  for(const line of heads.trim().split('\n')){const [key,label,...aliases]=line.split('|');term(key,label,aliases.join('|'),key==='floor'?'structure-part':'world-object');}
  for(const [key,label,pattern,facet]of [
    ['night','夜间','深夜|雨夜|夜行|夜班|夜间','time'],['dawn','清晨','清晨|晨光|早市','time'],
    ['dusk','傍晚','黄昏|傍晚','time'],['rain','降雨','雨夜|雨后|酸雨|雨季|雨街|雨巷|降雨|细雨|暴雨|骤雨|雨幕|雨声','weather'],
    ['neon','霓虹照明','霓虹','lighting'],['cold-white','冷白光','冷白光|冷白','lighting'],
    ['lower-level','下层','下层','vertical-context'],['upper-level','上层','上层','vertical-context'],
    ['underground','地下','地下|矿道','spatial-context'],['underwater','水下','海底|水下','spatial-context'],
    ['floating','浮空背景','浮空|浮岛|云港','setting-context'],['radiation','辐射背景','辐射|剂量','hazard-context'],
    ['low-gravity','低重力','低重力','gravity-context'],['zero-gravity','零重力','零重力','gravity-context'],['acid-rain','酸雨背景','酸雨','weather-type'],
  ])term(key,label,pattern,facet,'qualifier');

  const physicalLibraries=[...bodyLibraries,...worldLibraries.filter(l=>!['world-culture','world-sound','world-scent','world-weather'].includes(l))];
  for(const [key,label,pattern,facet]of [
    ['round','圆','圆肘|圆肩|圆腹|圆片|圆边|圆环|圆角|圆盘|圆点|圆瞳|半圆','shape'],
    ['flat','扁','扁足|扁掌|扁片|扁壳|扁盒','shape'],['pointed','尖','尖角|尖爪|尖齿|尖叶','shape'],
    ['drooping','垂','垂绺|垂尾|垂须|垂羽|垂枝','shape'],['curved','弯曲','弯曲|弧形|弧线|弯角','curvature'],
    ['straight','直','挺直|笔直|直立|直角','curvature'],['outward','外展','外展|外翻|外八','orientation'],
    ['inward','内收','内收|内扣|内卷','orientation'],['soft','柔软','软垫|柔软|柔帘|软接|软膜|软边','surface'],
    ['hard','坚硬','硬壳|硬质|坚硬|硬甲','surface'],['coarse','粗糙','微糙|粗糙|毛糙|砂面','surface'],
    ['smooth','光滑','光滑|细滑|平滑','surface'],['thin','细','细纹|细缝|细脊|细索|细链|细杆','dimension'],
    ['thick','厚','厚颈|厚肩|厚掌|厚板|厚墙|厚底|厚片','dimension'],['slim','薄','薄片|薄皮|薄膜|薄板|薄壳|薄廓','thickness'],
    ['short','短','短颈|短柱|短袖|短须|短爪|短链|短段','dimension'],['long','长','长脊|长须|长臂|长腿|长廊|长绳|长条','dimension'],
    ['shallow','浅','浅沟|浅纹|浅弧|浅坑|浅洼|浅刻','dimension'],['deep','深','深沟|深坑|深井|深凹','depth'],
    ['layered','层叠','层叠|多层|叠片|腹叠|瓦叠','shape'],['striped','条纹','线纹|条纹|纵纹|横纹','shape'],
  ])term(`physical.${key}`,label,pattern,facet,'qualifier',physicalLibraries);
  for(const [key,label,pattern]of [
    ['grey','灰','灰色|灰(?=瓦|墙|砖|衣|布|石|板|铁)'],['white','白','白色|白(?=墙|砖|石|布|衣|板|瓷)'],
    ['black','黑','黑色|黑(?=石|瓦|砖|布|衣|漆)'],['red','红','红色|红(?=砖|瓦|布|漆|灯)'],
    ['green','绿','绿色|绿(?=漆|灯|布|叶)'],['blue','蓝','蓝色|蓝(?=漆|灯|布|光)'],
    ['brown','褐','褐色|深褐|浅褐'],
  ])term(`world-color.${key}`,label,pattern,'color','qualifier',worldLibraries);
  const builtLibraries=['world-building','world-room','world-object','world-facility','world-workplace','world-terrain','body-clothing','body-accessory'];
  for(const [key,label,pattern]of [
    ['stone','石','石阶|石栏|石墙|石台|石室|石垒|石池|石板'],['iron','铁','铁桥|铁皮|铁栏|铁轨|铆钉铁'],
    ['brass','黄铜','黄铜(?!色|光|纹)'],['lead','铅','铅衬|铅板'],['adobe','土坯','土坯'],
  ])term(`built-material.${key}`,label,pattern,'material','qualifier',builtLibraries);

  const extraHeads=`
house|房屋|屋|厢房|阁楼|居所|民居|宿舍|公寓|平房
room|房间|房间|隔间|单间|居室|客房|寝室
capsule|舱室|休眠舱|压力舱|船舱|睡眠舱|舱室|舱内
roof|屋顶|屋顶|斜顶
eaves|屋檐|屋檐|檐下|檐影|雨檐
workshop|工坊|工坊|装配坊|修理坊
countertop|工作台|揉台|切台|案板|滤芯台|发条台|工坊台
platform|平台|平台|鹤栖台|露台|高台|码头坪
wharf|码头|码头
camp|营地|营地|宿营|营圈|营区|营帐
tent|帐篷|帐篷|帐房|帐棚
archway|牌坊|牌坊
dam|坝|坝|堤堰
waterway|水道|水道|河道|沟渠|暗渠
bay|湾|浅湾|海湾|河湾
vent|通气口|通气口|排气口|排水口|排水暗口
valley-floor|谷地|谷地|柱谷
snow-pit|雪坑|雪窝|雪坑
oasis|绿洲|绿洲
farmland|农田|农田|灵田|垄畦|菜畦|农垦
root|树根|板根|气根|树根
tree|树|榕|树干|椰枣|石榴|桉树|柚树
herb|草本植物|薄荷|吊兰|狗尾草|香草|野葱
flower|花|花瓣|野花|落花|花架
leaf|叶|叶面|叶背|叶脉|落叶
light-source|照明器|串灯|灯钩|灯台|灯具|油灯|夜灯|聚光灯
lantern|灯笼|灯笼|纸灯
gear|齿轮|齿轮
spring-component|弹簧|弹簧|发条
winch|绞盘|绞盘
anchor|锚|锚链|锚钩|锚桩
chain|链条|链条|锁链
container|集装箱|集装箱
grating|格栅|格栅|滤栅
pressure-monitor|气压表|气压表
radiation-monitor|辐射监测仪|盖革计数|辐射监测
bag|袋|布袋|手提袋|挎袋|纸袋
basin|盆|脸盆|洗手盆|水盆|洗盆
broom|扫帚|扫帚|竹帚
fan|风扇|风扇|排风机
sewing-machine|缝纫机|缝纫机
grindstone|砂轮|砂轮|磨轮
roller-shutter|卷闸|卷闸|卷帘门
lamp-post|灯柱|灯柱
handrail|栏杆|栏杆|桥栏|护栏
mask|面罩|面罩|口罩|面巾
shawl|披巾|披巾|肩巾
uniform|制服|制服|工作服|工装
apron|围裙|厨围|围裙
glove|手套|手套|指套
boot|靴|靴|雪鞋
water|水体|积水|再生水|浅水|水面|水塘
cloud|云|云海|云层|云絮
aurora|极光|极光
sandstorm|沙暴|沙暴|沙墙
air-pressure|气压|气压|静压|耳压
air-density|空气密度|稀薄空气|空气稀薄
water-vapor|水汽|水汽|冷凝水|水珠|凝水
magic-pattern|法术纹路|阵纹|符纹|禁制纹|法阵
language-signal|交流信号|暗语|暗号|手势规|语音日志礼
shift-work|轮值|轮值|轮班|交班|夜班
maintenance|检修|检修|整备|维护|检漏
mooring-action|系缆|系缆|系留缆|系泊缆
observation|观察|观察|观测
commute|通勤|通勤
overnight|过夜|过夜
scavenging|拾荒|拾荒|废料分拣
packing|装卸|装卸|卸货|装货
watch|值守|值守|巡更|守夜|巡逻
journey|行程|行程|路线|导航|拔营|登山道
station|驿站|沙驿|驿馆|驿站
hallway|走廊|走廊|管廊|吊廊|甬道
door|门|门|门闩
window|窗|窗|舷窗
yard|庭院|庭院|天井
shed|棚|棚|篷顶
floor|地板|地板|地面|铺地
shelf|置物架|衣物架|挂架|烘干架|兵器架|实验架|滤光片架
track|轨道|货轨|滑轨|轨枕|跑道
net|网|收集网|网兜|防坠网
barrel|桶|桶|水囊
pole|桩杆|桩|旗杆|标杆
bench|座位|床位|议价席|短训席
spa|浴场|浴场|澡堂|淋洗房|石池|浴石池
protective-clothing|防护衣|湿衣|舱外服|防毒服|披风|护腿
glasses|护目镜|护目|滤光片|狭缝镜
sock|袜|袜
drone|无人机|无人机
propeller|螺旋桨|螺旋桨
charger|充电桩|充电桩
connector|接口|接口
heater|加热器|加热器
solar-panel|太阳能板|太阳能板
treadmill|跑步机|跑步机
handle|把手|把手
torque|力矩|力矩
alarm|警报|警报|报警|蜂鸣
gust|乱流|乱流
cliff|崖壁|崖壁
geology|地质|地质|岩层|矿石|矿物|浮石
ice-ridge|冰脊|冰脊|压力丘
snow|积雪|吹雪|积雪
chaff|谷草|草垛|干草
fodder-trough|饲槽|饲槽
sail|帆|翼帆|风帆
flag-signal|旗语|旗语
warning-bell|警戒铃|警戒铃|警报钟|信号铃
glyph|符号|素描|标记|图案|旗帜
fire|火|炉火|火堆|营火
drying|烘干|烘干|晾干
cleaning|清洗|清洗|清理|清帐
checking|检查|晨检|清点|巡检|灯检
replacement|更换|更换|添注|添油
carrying|搬运|肩运|捆载|运输
weighing|称重|称重|报数
sealing|封口|封口
`;
  for(const line of extraHeads.trim().split('\n')){
    const [key,label,...aliases]=line.split('|');
    const libraries=['mask','shawl','uniform','apron','glove','boot','protective-clothing','sock','glasses'].includes(key)?[...worldLibraries,'body-accessory','body-clothing']:
      ['shift-work','maintenance','mooring-action','observation','commute','overnight','scavenging','packing','watch','journey','drying','cleaning','checking','replacement','carrying','weighing','sealing'].includes(key)?[...worldLibraries,'daily-work','daily-move','daily-rest']:worldLibraries;
    const facet=['shawl','apron','glove','uniform','boot','protective-clothing','sock'].includes(key)?'garment':key==='bag'?'object':key==='broom'?'tool':'world-object';
    term(`extra.${key}`,label,aliases.join('|'),facet,'core',libraries);
  }
  for(const line of `
chest|胸部|胸|胸廓
abdomen|腹部|腹|肚
elbow|肘|肘
knee|膝|膝
ankle|踝|踝
wrist|手腕|腕
neck|颈部|颈|脖
eye|眼|眼|瞳
mouth|口部|唇|口缘|口部
throat|喉部|喉
toe|趾|趾
paw-pad|掌垫|掌垫|肉垫|足心
collarbone|锁骨|锁骨
hair-lock|发绺|绺|发束|发辫
body-fold|褶|褶|折纹
body-slit|裂隙|线状缝|屈缝|透光隙
body-keratin|甲质|甲缘|趾甲|薄甲|盾片|半甲
`.trim().split('\n')){const [key,label,...aliases]=line.split('|');term(`anatomy.${key}`,label,aliases.join('|'),'body-part','core',bodyLibraries);}

  for(const [key,label,expression,facet]of [
    ['narrow','狭窄','狭窄|窄','width'],['broad','宽阔','宽阔|宽敞|宽道','width'],
    ['steep','陡峭','陡峭|陡坡|陡梯|窄而陡','slope'],['level','平坦','平坦|平整','surface-relief'],
    ['wet','潮湿','潮湿|湿润|湿冷|盐湿','moisture'],['dry','干燥','干燥|干热|干冷','moisture'],
    ['slippery','湿滑','湿滑|易滑','surface-friction'],['dusty','积尘','积尘|落灰|尘覆','cleanliness'],
    ['new','崭新','崭新|新建|新装','condition'],['old','陈旧','陈旧|破旧|(?<!怀)旧','condition'],
    ['damaged','破损','破损|破裂|残破|断裂','condition'],['rusty','生锈','锈蚀|锈迹|锈尘|生锈','condition'],
    ['street-facing','临街','临街|沿街|街边','placement'],['street-corner','街角','街角|转角','placement'],
    ['elevated','高架','高架|架空','vertical-context'],['roofed','有顶遮蔽','有顶|遮雨|遮阳|避雨','shelter'],
    ['open-air','露天','露天|敞开','enclosure'],['closed','封闭','封闭|密闭','enclosure'],
    ['shared','共用','共用|合用|共享|合住','access-context'],['public','公共','公共','access-context'],['rented','租用','合租|租住|租户','tenure-context'],
    ['crowded','拥挤','拥挤|挤满','occupancy'],['empty','空置','空置|无人使用','occupancy'],
    ['flicker','闪烁','闪烁|明灭','lighting'],['dim','昏暗','昏暗|暗淡|光线不足','lighting'],
    ['bright','明亮','明亮|亮堂','lighting'],['backlit','逆光','逆光','lighting'],
    ['loud','响亮','响亮|轰鸣|震耳','sound-volume'],['quiet','轻声','轻声|低声|细响','sound-volume'],
    ['echo','回响','回响|回声','sound-propagation'],['intermittent','间歇','间歇|断续|时断时续','continuity'],
    ['continuous','持续','持续|不停|不断','continuity'],['distant','远处','远处|远鸣|遥远','distance'],
    ['pungent','刺鼻','刺鼻|呛喉|呛鼻','scent-intensity'],['faint','淡薄','淡腥|淡淡|若有若无','scent-intensity'],
    ['cold','寒冷','严寒|夜寒|酷寒|寒冷','temperature'],['cooling','降温','骤降|降温','temperature-change'],
  ])term(`attribute.${key}`,label,expression,facet,'qualifier',worldLibraries);

  for(const [key,label,expression]of [
    ['sulfur','硫磺气味','硫磺'],['rust','锈味','锈|铁腥'],['dust','粉尘气味','石尘|粉尘|沙尘|热沙|焦土'],
    ['plastic','塑料气味','塑料'],['rubber','橡胶气味','橡胶'],['iodine','碘气味','碘'],['fuel','燃料气味','燃油|柴油|机油|煤油'],
    ['smoke','烟气味','烟|焦味|烧焦'],['salt','盐水气味','盐湿|海盐|咸腥'],['spice','香料气味','香料|肉桂|八角|丁香'],
    ['oil','油脂气味','油脂|油条|煎油|芝麻'],['pickles','发酵气味','泡菜|腌|酸辣|酒糟'],
    ['fruit','果香','瓜香|果香|果皮|柑橘|柚子'],['herb','草本气味','药材|草药|薄荷|青涩|草叶'],
    ['ozone','臭氧气味','臭氧'],['disinfectant','消毒液气味','消毒液'],['leather','皮革气味','干革|皮革'],
    ['sulfide','硫化物气味','硫化氢|臭蛋'],['mud','泥土气味','温泥|泥土|土味'],
  ])term(`scent.${key}`,label,expression,'scent-source','core',['world-scent']);
  for(const [key,label,expression]of [
    ['roll','滚动声','咕噜|滚动|碾过'],['friction','摩擦声','摩擦|吱轧|吱呀|吱声|刮擦'],
    ['impact','撞击声','敲|碰|嗒嗒|铛|咚|噼啪|拍响|打篷|咔哒'],['hiss','气流嘶声','嘶声|泄压|漏气'],
    ['buzz','嗡鸣','嗡鸣|嗡嗡'],['insect','虫声','蝉|蚊|蟋蟀|虫'],['flag','布料声','旗|猎猎|布料'],
    ['voice','人声','人声|吆喝|交谈|叫卖|喊声'],['snow','踩雪声','雪地靴|干雪|踩雪'],
    ['bell','钟鸣','钟鸣|鸣钟'],['whistle','尖啸','尖啸|尖鸣'],['alarm','警报声','警报|蜂鸣'],
  ])term(`sound.${key}`,label,expression,'sound-source','core',['world-sound']);
  term('culture.ritual','礼仪','礼仪|惯例|礼|规矩|誓','culture','core',['world-culture']);
  term('culture.conversation','沟通','对讲|交谈|议价','culture','core',['world-culture']);

  t.settingContexts={};
  for(const [key,label,themes]of [
    ['cyberpunk','赛博朋克',['赛博都市']],['post-apocalypse','灾后',['废土']],['space-station','空间站',['太空站']],
    ['desert','沙漠',['沙漠戈壁']],['gobi','戈壁',['沙漠戈壁']],['sky','天空',['天空浮空']],['floating','浮空',['天空浮空']],
    ['volcanic','火山',['火山熔岩']],['lava','熔岩',['火山熔岩']],['underground','地下',['矿道地下城']],
    ['snowfield','雪原',['雪原极地']],['polar','极地',['雪原极地']],['jungle','丛林',['丛林雨林']],['rainforest','雨林',['丛林雨林']],
    ['steampunk','蒸汽朋克',['蒸汽朋克']],['xianxia','仙侠',['仙侠洞府']],['underwater','水下',['海底水下']],
    ['fantasy','奇幻',['奇幻城镇城堡','奇幻地牢墓穴']],['modern','现代',['现代都市校园']],['campus','校园',['现代都市校园']],
    ['harbor','港口',['港口船舶']],['ship','船舶',['港口船舶']],['dungeon','地牢',['奇幻地牢墓穴']],
    ['grave','墓穴',['奇幻地牢墓穴']],['western','西部',['西部拓荒']],['frontier','拓荒',['西部拓荒']],
  ]){
    const id=`general-taxonomy:setting.${key}`;
    t.concepts.push({id,label,role:'qualifier',facet:'setting-context',definition:`来源主题的${label}背景；仅用于素材筛选，不向当前世界添加此设定。`,status:'proposed-editorial'});
    for(const theme of themes)(t.settingContexts[theme]??=[]).push(id);
  }

  // 新增词条的短名可作为原子概念；核心材料词不从身体比喻中推断。
  t.seedConceptIds={};
  for(const seed of seeds){
    const existing=t.concepts.find(c=>c.label===seed.label&&c.role===seed.role&&c.facet===seed.facet);
    const id=existing?.id??`general-taxonomy:common.${seed.key}`;
    if(!existing)t.concepts.push({id,label:seed.label,role:seed.role,facet:seed.facet,definition:seed.description,status:'authored-proposed'});
    t.seedConceptIds[seed.key]=id;
    let libraries;
    if(seed.library==='material')libraries=['world-object','body-accessory','body-clothing','body-mechanical'];
    else if(seed.library==='body-part')libraries=bodyLibraries;
    else if(seed.library.startsWith('world-'))libraries=worldLibraries;
    else if(seed.library==='npc-job')libraries=['npc-job'];
    else if(seed.library==='daily-action')libraries=catalog.filter(c=>c.group==='daily').map(c=>c.code);
    else if(seed.library==='social-action')libraries=['daily-talk','daily-interact','daily-social','npc-trait','npc-speech'];
    else libraries=[];
    if(libraries.length)t.rules.push({id:`common:${seed.key}`,conceptId:id,libraries,expression:seed.label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),source:'literal-span'});
    if(!t.buckets.some(b=>b.library===seed.library&&b.label===seed.subcategory))t.buckets.push({id:`general-bucket:common.${seed.library}.${seed.facet}`,library:seed.library,label:seed.subcategory,kind:'named'});
  }
  for(const library of new Set([...worldLibraries,...catalog.map(c=>c.code)]))t.buckets.push({id:`general-bucket:gap.${library}`,library,label:'环境候选',kind:'named'});
  t.attributeLibraries=[...t.attributeLibraries,'world-environment','world-space','material','world-state','relationship-context'];
  return t;
}
