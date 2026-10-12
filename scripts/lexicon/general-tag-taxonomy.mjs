/** 上传清单的离线编辑分类。不是游戏 TagDef，不授予状态或审核资格。 */
const concepts = new Map();
const rules = [];
export const taxonomyVersion = '1.0.0';
const body = ['body-build','body-form','body-surface','body-hair','body-scale','body-organ','body-beast','body-mechanical','body-anomaly'];
const objects = ['body-accessory','body-clothing','body-mechanical','world-object','world-building','world-room','world-facility','world-workplace'];

function define(key, label, role, facet, definition) {
  const id = `general-taxonomy:${key}`;
  if (concepts.has(id)) throw new Error(`Duplicate concept: ${id}`);
  concepts.set(id, { id, label, role, facet, definition, status: 'proposed-editorial' });
  return id;
}
function lexemes(libraries, facet, rows, role = 'core') {
  for (const [key,label,expression,definition] of rows) {
    const actualFacet = key === 'occasion.night' ? 'time' : key === 'occasion.rain' ? 'weather' : facet;
    const conceptId = define(key,label,role,actualFacet,definition ?? `${label}这一独立${role === 'core' ? '对象或概念' : '描述维度'}；仅用于素材检索，不证明游戏实体状态。`);
    rules.push({ id: `lexeme:${key}`, conceptId, libraries, expression, source: 'literal-span' });
  }
}

lexemes(['body-accessory','world-object'], 'object', [
  ['object.earring','耳饰','耳圈|耳环|耳坠'], ['object.bracelet','腕饰','腕串|腕箍|手镯|腕环|腕链'],
  ['object.pendant','挂坠','项链坠|门钥坠|钥坠|项坠|吊坠'], ['object.necklace','颈链','项链|颈链'],
  ['object.finger-ring','戒指','指环|指饰|戒指|废料戒|编织戒'], ['object.ring-ornament','环饰','石子环|压环|灯罩环'],
  ['object.brooch','胸针','胸针|穗针'], ['object.scarf','头巾','头巾'], ['object.handkerchief','手帕','擦汗帕|擦胶帕|手帕'],
  ['object.belt','束带','束布带|束废布带|腰带'], ['object.ribbon','饰带','嵌布条|发绳|布绳|窄废绳|滚边条|滚试边'],
  ['object.needle-case','针线筒','针线筒'], ['object.shears-case','剪具套','小剪套'], ['object.chalk-case','粉笔套','粉笔套'],
  ['object.tape-holder','量尺佩件','量尺环|软尺卷'], ['object.keyring','钥匙扣','钥匙扣|钥环'],
  ['object.flask-hook','水壶挂钩','水壶钩'], ['object.knife-case','刀具套','折刀槽|刀鞘'],
  ['object.glasses-hook','眼镜挂钩','眼镜钩|折镜钩'], ['object.badge','纪念牌','小铜牌|纪念牌'],
  ['object.body-paint','身体彩绘','彩泥点|点彩斑|腕彩点|浅线纹|眉尾纹|灰粉圈|淀粉痣'],
]);
lexemes(['body-clothing'], 'garment', [
  ['garment.trousers','裤','裤'], ['garment.skirt','裙','裙'], ['garment.shirt','衫','衫'],
  ['garment.jacket','褂','褂'], ['garment.coat','外套','外套|棉袄|季袄'], ['garment.robe','袍','袍'],
  ['garment.cloak','斗篷','斗篷'], ['garment.apron','围裙','围裙'], ['garment.glove','手套','手套'],
  ['garment.footwear','鞋靴','靴|鞋'], ['garment.vest','背心','背心|马甲'], ['garment.hat','帽','帽'],
  ['garment.top','上衣','袖衣|清洁衣|毛衣|领衣|半袖衣|旧衣|收边衣|汗衣|衬衣'],
  ['garment.sleeve-guard','护袖','护袖|袖套'], ['garment.wrap','披巾','巾披|披方巾|方试巾'],
]);
lexemes(body, 'body-part', [
  ['part.ear','耳','耳'], ['part.tail','尾','尾'], ['part.claw','爪','爪'], ['part.hoof','蹄','蹄'],
  ['part.muzzle','吻部','短吻|长吻|吻部'], ['part.nose','鼻','鼻'], ['part.whisker','须','细须|触须|须孔'],
  ['part.wing','翼','翼|羽臂'], ['part.fin','鳍','鳍'], ['part.webbing','蹼','蹼'],
  ['part.horn','角','软角|额角|角质结|角额|角冠'], ['part.sac','囊','囊'], ['part.cavity','腔','空腔|腔口|凹窝'],
  ['part.ridge','冠脊','冠脊|低冠|脊冠'], ['part.hand','手掌','手背|掌心|蹼掌'],
  ['part.finger','指','指节|指尖|指缝|指间'], ['part.foot','足','足底|足跟|脚底|踵缘'],
  ['part.arm','臂','小臂|前臂|羽臂'], ['part.leg','腿','小腿|腿长|足肢'],
  ['part.shoulder','肩','肩'], ['part.back','背','背脊|肩胛|背弧'], ['part.waist','腰','腰'],
  ['part.hip','胯','胯|髋'], ['part.membrane','膜','膜'], ['part.scale','鳞片','鳞'], ['part.armor','甲片','叠甲|鳞甲|甲片'],
]);
lexemes(['body-hair','body-beast'], 'covering', [
  ['cover.fur','毛','绒|长毛|扫毛|披毛|外毛'], ['cover.mane','鬃毛','鬃'],
  ['cover.hair','发丝','发|鬓|弧丝'], ['cover.feather','羽','羽'],
]);
lexemes(['body-mechanical'], 'mechanical-component', [
  ['mechanical.shell','外壳','臂壳|腿壳|手背|外壳'], ['mechanical.hinge','铰链','铰链'],
  ['mechanical.joint','关节','腕轴|膝节|关节'], ['mechanical.screw','螺钉','螺钉'],
  ['mechanical.pin','装饰钉','铜钉|饰钉'], ['mechanical.socket','接口','接口|圆口|螺口'],
  ['mechanical.latch','卡榫','卡榫'], ['mechanical.groove','凹槽','凹槽'],
  ['mechanical.decal','贴纸','贴纸'], ['mechanical.paint','漆绘','漆绘'], ['mechanical.tape','胶布','胶布'],
]);
lexemes(['body-anomaly'], 'appearance', [
  ['appearance.transparency','透光','浅透|半明|透明|澄光'], ['appearance.asymmetry','不对称','一高一低|左肩略高|右颊浅凹|非对称'],
  ['appearance.flow','流动外观','流纹|液面|波纹'], ['appearance.crystal','晶体外观','晶'],
  ['appearance.rock','岩石纹理','石纹|岩面'], ['appearance.double-shadow','重影','重影|双层光'],
  ['appearance.shadow-lag','影像滞后','迟落影|迟影'],
]);
lexemes(['world-object'], 'object', [
  ['object.jar','罐','罐|缸'], ['object.basket','篮','篮|竹筐'], ['object.box','箱','箱|盒'],
  ['object.knife','刀','刀'], ['object.hammer','锤','锤'], ['object.ruler','尺','尺'],
  ['object.bowl','碗','碗'], ['object.spoon','勺','勺'], ['object.tray','盘','盘'],
  ['object.cup','杯','杯'], ['object.bottle','瓶','瓶'], ['object.pot','壶','壶'],
  ['object.notebook','记录簿','账本|手账|记事本|分享簿|登记簿|日志'], ['object.noticeboard','记录板','记事板|记事牌'],
  ['object.folder','文件夹','活页夹|图纸夹|文件夹'], ['object.register','登记表','轮取表|轮值表|登记表'],
  ['food.radish','萝卜','萝卜'], ['food.cucumber','黄瓜','黄瓜'], ['food.noodle','面条','挂面|面条'],
]);
lexemes(['world-terrain'], 'terrain', [
  ['terrain.slope','坡','坡'], ['terrain.bank','岸','岸'], ['terrain.shallows','浅滩','浅滩'],
  ['terrain.rock-bank','石矶','石矶'], ['terrain.hole','洞','洞'], ['terrain.crevice','缝隙','缝|隙'],
  ['terrain.platform','台地','台|台基'], ['terrain.square','广场','广场'], ['terrain.open-ground','空地','空地|打谷场'],
]);
lexemes(['world-building','world-room','world-workplace','world-facility'], 'place-or-facility', [
  ['place.dwelling','住宅','排屋|板屋|住屋|住宅'], ['place.courtyard','院落','院'],
  ['place.workshop','作坊','作坊|面坊|磨坊|铁铺|裁缝铺'], ['place.pavilion','亭','亭'],
  ['place.hall','厅堂','旧堂|祠|残厅|会堂'], ['place.shed','棚','棚'], ['place.station','驿站','驿站'],
  ['place.bedroom','卧室','卧|卧房'], ['place.living-room','客厅','客厅'], ['place.reading-room','阅览室','阅览间|阅览室'],
  ['place.storeroom','储藏室','储藏|柜房|柴间|米缸暗间'], ['place.entrance','玄关','玄关'],
  ['place.stairs','楼梯平台','楼梯转弯台'], ['place.corridor','廊','廊|穿堂'],
  ['facility.lamp','灯','灯柱|灯龛|蜡台|灯架|照明灯'], ['facility.well','井','井'],
  ['facility.water-channel','水槽','分水槽|水槽'], ['facility.rain-vat','接雨缸','接雨缸'],
  ['facility.seat','坐具','长凳|木墩|石墩|座椅'], ['facility.noticeboard','告示板','通告板|黑板|告示板|传单栏'],
  ['facility.tool-rack','工具架','工具架'], ['facility.mending-kit','修补盒','补丁盒|针线盒'],
  ['facility.ladder','踏凳','踏凳|梯'], ['facility.reading-board','读报栏','读报栏'],
  ['place.stall','摊位','摊|寄卖柜|蔬果行'], ['place.transit','中转场','中转坪|停靠湾'],
  ['place.clinic','诊疗场所','诊疗|诊所'], ['place.rest-area','休息场所','休息室|晒背坪'],
]);
lexemes(['world-nature'], 'ecology', [
  ['ecology.fern','蕨','蕨'], ['ecology.ivy','攀缘植物','爬山虎|藤'], ['ecology.shrub','灌木','冬青|灌木'],
  ['ecology.moss','苔','苔|薄绿衣'], ['ecology.algae','藻','藻'], ['ecology.fungus','菌','菌|蘑菇'],
  ['ecology.track','足迹','爪印|足印'], ['ecology.nest-trace','巢痕','燕泥|巢'],
  ['ecology.feather-trace','遗羽','鸽羽|落羽'], ['ecology.grass','草','草带|草地'],
  ['ecology.garden','圃','荒圃|菜圃'],
]);
lexemes(['npc-job'], 'occupation', [
  ['job.tailor','缝纫工','缝补|缝边|缝工|裁剪|缝纫'], ['job.carpenter','木工','木工|填补工|椅.*修|刨|木料'],
  ['job.painter','漆工','漆工|刷漆'], ['job.metalworker','金工','铁匠|焊工|钳工|锻|磨刀'],
  ['job.weigher','称重员','称重|过秤'], ['job.reception','接待员','接待员'], ['job.guide','引导员','引导|迎导|向导'],
  ['job.custodian','看管员','看管|保管|管理员'], ['job.scribe','记录员','记录员|抄录|建档|年表编纂'],
  ['job.reader','代读员','代读|读报'], ['job.cleaner','清洁工','清扫|清屑|清理员|保洁'],
  ['job.clerk','办事员','窗口员|备案|登记员'], ['job.porter','搬运工','搬运|挑担'],
  ['job.courier','递送员','递送|送水|送报|送货'], ['job.cook','厨工','厨|面点|炊|烹'],
  ['job.carer','照护员','照护|护理|看护'], ['job.teacher','教习','教习|教师|授课'],
  ['job.mediator','调解员','调解|协调员'], ['job.vendor','售货员','售货|售卖|销售|摊主'],
]);
lexemes(['npc-identity'], 'identity-topic', [
  ['identity.resident','住户','住户|居者|租客|试住者|暂住者'], ['identity.apprentice','学徒','学徒'],
  ['identity.association','社群成员','互助会|互助队|同门|社团|互助组'],
  ['identity.sibling','兄弟姐妹','兄妹|姐弟|兄弟|姐妹'], ['identity.housemate','合住者','合住|合租|同住'],
  ['identity.representative','社区代表','代表|意见收集员'], ['identity.volunteer','志愿者','志愿|轮值'],
]);
lexemes(['npc-interest','npc-goal','npc-history'], 'activity-topic', [
  ['activity.collect','收藏','收藏|标本|票根册'], ['activity.draw','绘画','速写|绘画|画画'],
  ['activity.write','记录','记录|手账|日志|记谱'], ['activity.exercise','锻炼','拉伸|锻炼'],
  ['activity.meditate','冥想','冥想'], ['activity.volunteer','志愿服务','轮值|义修|报名台'],
  ['activity.learn','学习','学会|求学|学徒|练习'], ['activity.repair','修补','修好|修补|缝补|加固|修复'],
  ['activity.relocate','迁居','搬到|搬家|迁居|试住'], ['activity.shared-meal','共餐','共餐|一起吃饭'],
  ['activity.boundary','保持边界','保持.*距离|互相尊重'], ['activity.recover','恢复','重来|病愈|伤愈'],
]);
lexemes(['npc-trait','npc-value','npc-habit','npc-speech'], 'disposition-topic', [
  ['disposition.ask-first','事先询问','先问|先.*问清|先征求'], ['disposition.helpfulness','助人','再帮|热心|愿意帮|互助'],
  ['disposition.privacy','尊重隐私','不问.*隐私|保留隐私'], ['disposition.permission','尊重权限','不动他人|不进他人|不擅入|借前先问'],
  ['disposition.caution','谨慎','量两次|谨慎|先试|先检查|先看'], ['disposition.brevity','简洁表达','短句|说重点|少话'],
  ['disposition.curiosity','好奇','看结构|必读|辨.*磨损|盯着.*变|好奇'],
  ['disposition.tension','紧张表现','发紧|坐立不安|焦躁'], ['disposition.resource-care','惜物','物尽其用|废料.*用|珍惜'],
]);

// 物理修饰只从短名称抽取；不从姓名、对白或比喻性的皮肤触感猜材质。
lexemes(objects, 'material', [
  ['material.brass','黄铜','黄铜(?!色|光|纹)'], ['material.copper','铜','(?<!黄)铜(?!色|光|纹)'], ['material.iron','铁','铁(?!色|光|纹)'],
  ['material.tin','锡','锡'], ['material.ceramic','陶瓷','陶瓷|陶珠|陶片|陶罩|陶水罐'],
  ['material.glass','玻璃','玻璃'], ['material.bone','骨','骨片|骨扣'], ['material.shell','贝壳','贝壳|贝钮|贝坠'],
  ['material.wood','木','木(?!纹|色)|刨花'], ['material.bamboo','竹','竹'], ['material.stone','石','石子|石墩|石基'],
  ['material.cotton','棉','棉'], ['material.canvas','帆布','帆布'], ['material.hemp','麻','麻绳|麻布'],
  ['material.leather','皮革','皮垫|皮革'], ['material.rattan','藤','藤(?!纹|色)'],
], 'qualifier');
lexemes([...body,...objects], 'surface', [
  ['surface.matte','哑光','哑光'], ['surface.glossy','光亮','柔亮|高光|微亮|擦亮'],
  ['surface.transparent','透明','半透明|透明'], ['surface.soft','柔软','软折|柔垫|软肤|软角'],
  ['surface.hard','坚硬','硬鬃|硬边'], ['surface.coarse','粗糙','粗瓷|粗布'],
], 'qualifier');
lexemes([...body,...objects], 'shape', [
  ['shape.round','圆','圆耳|钝圆|磨圆|圆口|圆领|圆鳞'], ['shape.pointed','尖','尖耳|尖端'],
  ['shape.flat','扁','扁尾|扁水壶'], ['shape.drooping','垂','垂耳'],
  ['shape.ball','球状','绒球'],
  ['shape.ringed','环纹','环纹'], ['shape.striped','条纹','条纹'], ['shape.spotted','斑点','斑纹|小点|雀斑|点彩'],
  ['shape.serrated','齿状','齿状'], ['shape.stacked','层叠','叠甲|瓦叠|叠片'],
  ['shape.wire','丝状','铜丝|铁丝'], ['shape.woven','编织','编织|缠线'],
], 'qualifier');
lexemes([...body,...objects], 'dimension', [
  ['dimension.thin','细','细铜丝|细绒|细发|细鳞|细须|细线'], ['dimension.thick','厚','厚袖|厚壳|厚布'],
  ['dimension.short','短','短尾|短吻|短毛|短腰|短鳍|短披'], ['dimension.long','长','长毛|长尾|长柄|长线'],
  ['dimension.small','小','小翼芽|小铜牌|小剪|小花'], ['dimension.large','大','大片鳞|大口|大箱'],
  ['dimension.shallow','浅','浅囊|浅凹|浅槽'],
], 'qualifier');
lexemes(objects, 'condition', [
  ['condition.old','旧','旧'], ['condition.worn','磨损','磨花|磨损|半剥'], ['condition.exposed','外露','外露'],
  ['condition.modified','改制','改裤|改褂|加长袖|扩腰'],
], 'qualifier');
lexemes(['body-accessory','body-clothing','body-mechanical'], 'placement', [
  ['placement.wrist','腕部','腕上|腕侧|腕缠'], ['placement.waist','腰间','腰间|腰带|腰扣'],
  ['placement.chest','胸前','胸前|胸扣'], ['placement.collar','领部','领口|领后'],
  ['placement.ankle','踝部','踝侧|踝上'], ['placement.shoulder','肩部','肩上|肩带|肩披'],
  ['placement.hair','发部','发间|发际'], ['placement.sleeve','袖部','袖口|袖袋|袖内'],
], 'qualifier');
lexemes(['body-accessory'], 'occasion', [
  ['occasion.enrolment','入学','入学'], ['occasion.graduation','出师','出师'],
  ['occasion.first-pay','首次收入','初薪|首薪'], ['occasion.recovery','康复','病愈|伤愈'],
  ['occasion.relocation','迁居','迁居'], ['occasion.apprenticeship','师承','师赠|师磨|同门'],
  ['occasion.night','夜间','雨夜|夜班'], ['occasion.rain','降雨','雨夜'],
], 'qualifier');
lexemes(['body-color','body-clothing','body-accessory','body-mechanical'], 'color', [
  ['color.grey','灰','灰'], ['color.brown','褐','褐'], ['color.white','白','白'],
  ['color.yellow','黄','米黄|浅黄|鹅黄'], ['color.pink','粉','浅粉|粉红'],
  ['color.blue','蓝','蓝|藏青'], ['color.green','绿','绿'], ['color.red','红','红|绛'], ['color.black','黑','黑'],
  ['color.apricot','杏色','杏'],
], 'qualifier');
lexemes(['body-color'], 'color-pattern', [
  ['color-pattern.gradient','渐变','褪|磨浅|渐变|淡影'], ['color-pattern.spot','斑点','点|斑'],
  ['color-pattern.ring','环纹','环|圈'], ['color-pattern.stripe','条纹','线|纹'],
  ['color-pattern.partial','局部配色','指尖|耳垂|眼周|膝|袖口|发际'],
], 'qualifier');
lexemes(['body-accessory'], 'object', [
  ['object.cloth-patch','布片','护布片|练功片'], ['object.tassel','穗饰','布穗|线穗'],
  ['object.bag','袋','布袋筒|钉扣筒'], ['object.pin-set','别针','别针|备用针'],
  ['object.cloth-knot','布结','布结'], ['object.bead','珠饰','泥塑珠'], ['object.ticket-holder','票夹','船票夹|票据夹'],
  ['object.string','绳段','红绳段'], ['object.whetstone','磨石','磨石片|石片赠'],
  ['object.coin-charm','币饰','碎币孔'],
]);
lexemes(['body-surface'], 'surface-topic', [
  ['surface-topic.skin','皮肤触感','触肤|匀面|凉感|薄韧|沫软|微糙|温润|团弹|灰干|湿润'],
  ['surface-topic.keratin','角质','角斑|护片|角质'], ['surface-topic.texture','纹理','纹|年轮'],
  ['surface-topic.sheen','表面光泽','哑光|柔亮|高光|微光|柔光'],
]);
lexemes(['body-build'], 'body-outline', [
  ['body-outline.stance','站姿','倾立|外八|站姿|内扣|直膝'], ['body-outline.posture','姿态','侧身|插袋|垂臂|挺胸|坐姿'],
  ['body-outline.volume','体量','薄影|墩影|条影|体量'],
]);
lexemes(['npc-job'], 'work-object', [
  ['work-object.textile','布料','布袋|篷布|遮阳帘|接缝'], ['work-object.furniture','家具','旧椅|椅|家具'],
  ['work-object.canopy','雨棚','雨棚|避雨篷'], ['work-object.waterway','水渠','渠务|渠岸'],
  ['work-object.street','街道','街沿|石阶|门口'], ['work-object.records','档案','日志|年表|登记|备案'],
  ['work-object.household-sign','门牌','门牌'], ['work-object.newcomer','新住户','新住户|迁居'],
], 'qualifier');
lexemes(['world-weather'], 'weather-topic', [
  ['weather.rain','雨','雨'], ['weather.fog','雾','雾'], ['weather.sunlight','日光','阳光|晴天'],
  ['weather.wind','风','风'], ['weather.cold','寒冷感','凉|冷'], ['weather.heat','炎热感','热|暖'],
]);
lexemes(['world-sound'], 'sound-source', [
  ['sound.water','水声','流水|水声|滴水'], ['sound.footsteps','脚步声','脚步|拖鞋踢踏'],
  ['sound.tools','工具声','秤砣|锅铲|竹帚'], ['sound.birds','鸟声','麻雀|鸣叫|翅羽'],
  ['sound.wind','风声','树叶摩擦|风声'], ['sound.insects','虫鸣','蝉鸣|虫鸣'],
  ['sound.machine','机器声','电梯|风扇|链|机声'], ['sound.bell','铃声','铃声|钟声'],
]);
lexemes(['world-scent'], 'scent-source', [
  ['scent.food','食物气味','米香|面粉|葱香|炖汤|水果甜|油烟'], ['scent.plant','植物气味','艾草|青草|草汁'],
  ['scent.wood','木材气味','松木|木气'], ['scent.soap','皂味','皂'],
  ['scent.damp','潮湿气味','潮气|闷湿|潮腥|土腥'], ['scent.fish','鱼腥','鱼腥'],
]);

// 语言功能从来源子类保守提取，长句原样保留为例句。
const bucketRoles = {
  'daily-work': ['action.prepare|准备','action.make|制作','action.inspect|检查','action.organize|整理','action.handover|交接'],
  'daily-food': ['action.cook|备餐','action.taste|品尝','action.share|分享','action.wash-dishes|清理餐具','action.drink|饮用'],
  'daily-rest': ['action.sit-rest|坐歇','action.relax|放松','action.be-alone|独处','action.pause|停顿','action.prepare-sleep|睡前整理'],
  'daily-move': ['action.walk|步行','action.climb|攀行','action.swim|游动','action.slide|滑行','action.carry|搬运'],
  'daily-talk': ['speech.listen|倾听','speech.change-topic|转移话题','speech.confirm|确认','speech.find-words|斟酌措辞','speech.end-topic|结束话题'],
  'daily-observe': ['action.inspect-near|近看','action.look-far|远望','action.compare|比较','action.listen|侧听','action.search|翻查'],
  'daily-interact': [null,'speech.ask-directions|问路','action.prepare-cooperation|协作准备','action.make-room|让出空间','speech.invite|邀请'],
  'daily-social': ['speech.greet|问候','action.host|待客',null,null,'speech.contact|联络'],
  'daily-life': ['action.clean|清洁','action.repair|修补','action.store|收纳','action.prepare-shopping|购物准备','action.self-care|个人照料'],
  'text-opening': ['speech.open-business|事务开场','speech.open-chat|闲聊开场',null,'speech.greet|问候','speech.probe-topic|试探话题'],
  'text-reply': ['speech.agree|赞同','speech.hesitate|迟疑','speech.clarify|澄清','speech.disagree|异议','speech.defer|暂缓回答'],
  'text-refusal': ['speech.decline-help|拒绝帮忙','speech.decline-invitation|拒绝邀请','speech.protect-privacy|保留隐私','speech.end-topic|结束话题','speech.offer-alternative|提出替代'],
  'text-farewell': ['speech.temporary-leave|暂离','speech.work-farewell|工作告别','speech.farewell|道别','speech.no-appointment|未约定再见','speech.open-ended-farewell|留有余地'],
  'text-emotion': ['emotion.joy|高兴','emotion.irritation|烦闷','emotion.regret|惋惜','emotion.relief|释然',null],
  'text-body': ['action.stretch|舒展','action.adjust-pose|调整姿态','action.adapt-space|适应空间',null,'body.balance|重心'],
  'text-tf-sense': ['tf.unfamiliar-outline|轮廓陌生感','tf.sensory-change|感官变化','tf.material-sensation|材质触感','body.balance|重心',null],
  'text-tf-adapt': ['tf.practice|动作练习','tf.adapt-clothing|衣物适应','tf.adapt-tools|工具适应','tf.self-recognition|自我认识','tf.communicate|表达变化'],
  'npc-address': ['speech.first-address|初见称呼','speech.peer-address|同行称呼','speech.familiar-address|熟人称呼','speech.formal-address|正式称呼','speech.introduce|自我介绍'],
  'npc-expression': ['expression.gaze|目光','expression.face|表情','expression.posture|姿态表现','expression.hesitation|犹豫表现','expression.relaxation|放松表现'],
  'world-detail': ['trace.wear|磨损','trace.placement|摆放','environment.light-shadow|光影','ecology.growth|生长','trace.activity|活动痕迹'],
  'text-environment': ['environment.space|空间','environment.light|光线','trace.use|使用痕迹','environment.crowd|人群','narration.perspective|视角'],
  'text-encounter': ['encounter.pass|擦肩','encounter.wait|等候','encounter.chat|闲聊','encounter.watch-work|工作旁观','encounter.daily-incident|生活插曲'],
  'world-culture': ['culture.etiquette|礼节','culture.festival|节庆','culture.mutual-aid|互助习俗','culture.public-art|公共艺术','culture.organization|组织文化'],
};
export function createTaxonomy(catalog) {
  const dictionary = new Map(concepts);
  const bucketRules = [];
  const buckets = catalog.flatMap(c => c.subcategories.map((label,i) => {
    const bucket = { id: `general-bucket:${c.code}.${String(i+1).padStart(2,'0')}`, library:c.code, label, kind:c.kind };
    const item = bucketRoles[c.code]?.[i];
    if (item) {
      const [key,label] = item.split('|');
      const id = `general-taxonomy:${key}`;
      if (!dictionary.has(id)) dictionary.set(id,{id,label,role:'core',facet:key.split('.')[0],definition:`原素材的${label}叙事功能或主题；不证明行动已经发生。`,status:'proposed-editorial'});
      bucketRules.push({id:`bucket:${bucket.id}`,conceptId:id,library:c.code,subcategory:bucket.label,source:'source-subcategory'});
    }
    return bucket;
  }));
  return { format:'aetheria-general-editorial-taxonomy',schemaVersion:1,version:taxonomyVersion,domain:'general',runtimeImportable:false,
    concepts:[...dictionary.values()],buckets,rules:[...rules,...bucketRules],
    protectedLibraries:['npc-name','npc-alias'],attributeLibraries:['body-color'],protectedSubcategories:{'world-district':['街名','巷名','街区名','聚落名']} };
}
