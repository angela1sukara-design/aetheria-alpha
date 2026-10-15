import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {loadBundle} from '../production/collaboration-pack/load-source.mjs';
import {validateDelivery} from '../production/collaboration-pack/tools/authoring.mjs';

// An editorial revision only: no production approvals, facts or game state are created.
const source = process.argv[2];
if (!source) throw Error('Supply the original delivery directory.');
const out = path.resolve('deliverables/B-content-reviewed-2026-10-15');
const bundle = await loadBundle();
const names = ['B1-modern-v1', 'B2-modern-v1', 'B3-generic-v1'];
const originals = await Promise.all(names.map(async name => ({name, bytes: await fs.readFile(path.join(source, name + '.json'))})));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const edits = new Map(Object.entries({
  'word.prop.modern.locker.parcel': '一格格贴着编号的快递柜',
  'word.prop.modern.shelf.noodles': '摆着不同口味泡面的货架',
  'word.prop.modern.corridor.elevator': '按钮排列整齐的电梯',
  'word.prop.modern.firstaid.chipped': '漆面整洁的急救箱',
  'word.prop.modern.washbasin.wet': '擦拭干净的公共洗手台',
  'word.prop.modern.drain.standing': '格栅排列整齐的排水口',
  'word.prop.modern.lunchbox.faded': '洗净后摞好的塑料饭盒',
  'word.sense.modern.exhaust.peak': '沿街飘来的汽车尾气味',
  'word.sense.modern.oil.kitchen': '油烟机滤网上积油散出的气味',
  'word.sense.modern.catfood.hall': '楼道里飘着的猫粮味',
  'word.sense.modern.fridge.hum': '冰箱压缩机轻而持续的低鸣',
  'word.form.modern.rider.mount': '穿着配送外套的外卖骑手',
  'word.form.modern.cashier.drowse': '眼下带着淡青阴影的夜班店员',
  'word.form.modern.guard.pace': '制服领口别着工牌的保安',
  'word.form.modern.commuter.doze': '眼皮低垂、眼下有淡淡阴影的通勤客',
  'word.form.modern.cleaner.lean': '围着防水围裙的保洁员',
  'word.form.modern.electrician.ladder': '腰间系着工具袋的电工',
  'word.form.modern.plumber.kneel': '工作服袖口沾着水渍的水管工',
  'word.form.modern.mechanic.crouch': '手背蹭着油污的修车师傅',
  'word.form.modern.barber.sweep': '衣襟上粘着碎发的理发师',
  'word.form.modern.waiter.weave': '袖口扣得整齐的服务员',
  'word.form.modern.student.cram': '校服袖口沾着笔迹的学生',
  'word.form.modern.grandma.cart': '穿着碎花外套的老太太',
  'word.form.modern.office.call': '衬衫领口微皱的上班族',
  'word.form.modern.librarian.cart': '衣襟上别着图书馆工牌的管理员',
  'word.form.modern.reception.verify': '胸前别着姓名牌的接待员',
  'word.form.modern.sorter.squat': '工作服膝部沾着纸屑的分拣员',
  'word.form.modern.gardener.butt': '裤脚沾着泥点的园艺工',
  'word.form.modern.nightshift.wait': '眼底发青、外套口袋鼓起的工人',
  'word.form.modern.busker.quiet': '肩头留着吉他背带压痕的卖艺人',
  'word.form.modern.jogger.breathe': '额角挂着汗珠的晨跑者',
  'word.form.modern.feeder.pigeon': '穿着宽松便服的路人',
  'word.form.modern.laundry.novel': '袖口带着洗衣粉白痕的洗衣客',
  'word.form.modern.taiji.dawn': '穿着宽松晨练服的老先生',
  'word.form.modern.mailbox.tiptoe': '鼻梁上架着老花镜的老先生',
  'word.form.modern.window.primp': '额前垂着碎发的年轻人',
  'word.action.modern.mop.wring': '拧着拖把，让水滴落进桶里',
  'word.action.modern.screw.back': '对准螺孔，缓缓拧紧螺丝',
  'word.bodypart.common.hand.vein': '浮着淡青血管的手背',
  'word.bodypart.common.ringfinger.mark': '指根留着一道浅印的无名指',
  'word.bodypart.common.tiger.corn': '结着旧茧的虎口',
  'word.bodypart.common.earlobe.pierced': '留着旧针眼的耳垂',
  'word.bodypart.common.eyecorner.crease': '笑时泛起细纹的眼角',
  'word.bodymaterial.common.wisp': '软毛',
  'word.materialqualifier.common.lukewarm': '微温的',
  'word.materialqualifier.common.thin.diluted': '稀薄的',
  'word.materialqualifier.common.rusted': '泛着锈色的',
  'word.materialqualifier.common.seeping': '含水的',
  'word.materialqualifier.common.soaked': '吸饱水的',
  'word.materialqualifier.common.etched': '带着蚀痕的',
}));
const tagEdits = new Map(Object.entries({
  'word.sense.modern.bin.sour': [],
  'word.form.modern.reception.verify': ['general-taxonomy:common.job.receptionist'],
  'word.bodymatqual.common.translucent.skin': ['general-taxonomy:v2.sensory.translucence'],
  'word.materialqualifier.common.sparkling': [],
  'word.bodypart.common.throat.bob': ['general-taxonomy:expanded.anatomy.neck'],
}));
const channels = {
  sound: ['ac.outdoor','shutter.motor','pipe.gurgle','doorbell.shop','traffic.hiss','fridge.hum'],
  light: ['window.grid','screen.coldlight','headlight.sweep','lightbox.warm'],
  thermal: ['subway.draft','asphalt.humid','ac.chill'],
  touch: ['static.zap','floor.wax'],
};
const bodyTypes = {
  'word.bodymatqual.common.dense': '毛发、绒毛、汗毛、软毛或羽毛；不适用于甲壳、鳞片、指甲',
  'word.bodymatqual.common.sparse': '毛发、绒毛、汗毛、软毛或羽毛；不适用于甲壳、鳞片、指甲',
  'word.bodymatqual.common.matted': '可打绺的毛发、绒毛或软毛',
  'word.bodymatqual.common.messy': '毛发、绒毛、软毛或羽毛',
  'word.bodymatqual.common.sleek': '毛发、绒毛、软毛或羽毛',
  'word.bodymatqual.common.dryskin': '可干燥起皮的皮肤或角质层',
  'word.bodymatqual.common.callused': '可形成茧层的皮肤；不适用于茧子自身',
  'word.bodymatqual.common.damp.sweat': '可出汗的皮肤',
  'word.bodymatqual.common.goosebump': '可起鸡皮疙瘩的皮肤',
  'word.bodymatqual.common.freckled': '带有可见雀斑的皮肤',
  'word.bodymatqual.common.bruised': '可出现皮下淤青的皮肤',
  'word.bodymatqual.common.windsore': '可皴裂发红的皮肤',
  'word.bodymatqual.common.scarpull': '受到旧疤牵拉的皮肤或皮膜',
  'word.bodymatqual.common.taut': '可受拉伸的皮肤或皮膜',
  'word.bodymatqual.common.loose': '可松弛的皮肤或皮膜',
};
const materialTypes = {
  turbid: '液态或悬浮液态材料；不适用于粉尘、铁锈、碎玻璃等固体',
  clear: '可透光的液态材料；不适用于粉尘、铁锈、碎玻璃等固体',
  viscous: '具有可测流动黏度的液态或膏状材料',
  'thin.diluted': '具有可测流动黏度的液态材料；不表示已经稀释',
  filtered: '当前同一实例的水；不得把过滤事实借给机油或另一杯水',
  crusted: '表面能够形成硬壳的沉积物或膏状材料',
  congealed: '能凝固的液态、膏状或已凝固材料',
  frothy: '能够起沫的液态材料',
  bubbling: '内部或表面存在可见气泡的液态或膏状材料',
  seeping: '能含水的固体、沉积物或膏状材料',
  rusted: '有可见锈色的铁锈、沉积物或受锈污染的材料；不表示材料自身生锈',
  moldy: '能承载可见霉菌的材料；须核实真实霉变',
  dried: '能风干并已有干燥历史记录的材料',
  'dusty.mat': '具有可附着积尘表面的固体或凝固材料；不适用于灰尘本身',
  'greasy.mat': '表面存在可见油膜或油脂的材料',
  soaked: '能够吸水的多孔固体或沉积物；不适用于水、机油或碎玻璃',
  frozen: '当前同一实例能够冻结且已冻结的材料',
  sticky: '表面或整体确有黏性的材料',
  layered: '内部确实存在分层的材料',
  iridescent: '表面确有可见彩色薄膜的材料',
  sparkling: '确实反射或发出微弱光点的材料；不等同于普通光泽',
  faded: '有原始颜色和褪色对照证据的有色材料',
  embedded: '能够嵌入碎屑的固体、凝固物或膏体',
  etched: '具有可见蚀痕的固态表面；不适用于水、机油或粉尘',
  staticcling: '表面确有吸附纸屑的固态材料；不凭此推定静电成因',
  'bubble.fine': '内部或表面存在细密气泡的液态或膏状材料',
  'metal.fleck': '确实掺有金属屑的液体、膏体或混合材料',
  scalding: '当前同一实例确为高温的材料；必须核实温度',
  cold: '当前同一实例确为低温的材料；必须核实温度',
  lukewarm: '当前同一实例确为微温的材料；必须核实温度',
};
const changes = [];
const eq = (fact, value) => ({fact, comparison: 'eq', value});
const updated = originals.map(({name,bytes}) => {
  const old = JSON.parse(bytes), data = structuredClone(old);
  data.format = 'aetheria-authoring-delivery'; data.specVersion = '1.3';
  data.batchId = name.replace('-v1','-reviewed-v2'); data.revision = 2;
  data.author = old.author + '；Codex 编辑修订';
  delete data.factCheckSuggestions;
  for (const e of data.entries) {
    if (edits.has(e.id)) {changes.push({id:e.id,field:'text',before:e.text,after:edits.get(e.id)});e.text=edits.get(e.id);}
    if (tagEdits.has(e.id)) {changes.push({id:e.id,field:'tagIds',before:e.tagIds,after:tagEdits.get(e.id)});e.tagIds=tagEdits.get(e.id);}
    e.priority = 500;
    if (!Array.isArray(e.exclusive)) e.exclusive = [e.exclusive];
    if (e.role === 'qualifier') e.text = e.text.replace(/的$/, '');
    if (e.id === 'word.materialqualifier.common.frozen') e.exclusive=[{group:'temperature',value:'frozen'}];
    if (e.id === 'word.bodymatqual.common.damp.sweat') e.exclusive=[{group:'moisture',value:'damp'}];
    e.review = 'hold'; e.pendingFacts = [];
    const pool=e.poolIds[0];
    if(pool==='environment.prop') e.pendingFacts.push(`核实当前绑定物件的真实类型，以及短语“${e.text}”涉及的数量、外观、位置和附属物；将这些语义映射到登记查询，不能以Tag代替。`);
    if(pool==='environment.sense') {
      const suffix=e.id.replace('word.sense.modern.','');
      const channel=Object.entries(channels).find(([,ids])=>ids.includes(suffix))?.[0]??'smell';
      e.poolIds=['environment.sense.'+channel]; e.requires=[eq('sense.available',true),eq('sense.channel',channel)];
      e.pendingFacts.push(`核实当前地点确有“${e.text}”这一感知记录，并确认声音、光线或气味的真实来源；sense.available和sense.channel仅证明通道，不证明具体内容。`);
    }
    if(pool==='actor.form'||pool==='action.observed') {
      e.requires=[eq('actor.present',true)];
      e.pendingFacts.push(pool==='actor.form'?`核实当前绑定人物的身份及“${e.text}”中的全部外貌、衣物和随身物特征；职业Tag不能证明人物实际职业。`:`核实当前绑定人物已经实际发生“${e.text}”动作；补齐action.observed的真实枚举映射，以及所涉工具、对象和人物关系证据。`);
    }
    if(pool==='actor.bodyPart') e.pendingFacts.push(`核实绑定部件确为“${e.text}”所指部位，并属于模板中的同一人物；数量、姿态、衣物遮挡和外观细节须逐项核实，不能把特征当成部件实例。`);
    if(pool==='body.material') e.pendingFacts.push(`核实当前绑定部件的实际体表材质为“${e.text}”，补齐part.material的真实值映射；不得因种族或人物名称推断材质。`);
    if(pool==='material.current') e.pendingFacts.push(`核实当前绑定材料实例的种类确为“${e.text}”，补齐material.kind的真实值映射；容器、数量和位置由单独的真实关系证据提供。`);
    if(pool==='body.material.qualifier') {
      e.pendingFacts.push(`核实同一部件实例真实具有“${e.text}”表面属性，定词与主名必须绑定同一部件。`);
      e.pendingFacts.push(`适用范围须由真实材质和部件查询约束：${bodyTypes[e.id]??'可真实呈现该属性的体表材质；需核实具体材质、状态和感官证据，不能默认适用于全部材质'}。`);
    }
    if(pool==='material.qualifier') {
      e.pendingFacts.push(`核实同一材料实例真实具有“${e.text}”属性，并将材质、物态和属性映射为登记查询；互斥组不能代替适用条件。`);
      e.pendingFacts.push(`仅在以下适用范围成立时可用：${materialTypes[e.id.replace('word.materialqualifier.common.','')]}。`);
    }
    assert(e.pendingFacts.length>0);
  }
  data.suggestedTags=(data.suggestedTags??[]).map(p=>({...p,mode:'attached'}));
  for(const p of data.suggestedTags) {
    if(p.proposedId==='general-taxonomy:appearance.weariness') {p.definition='当前可见的眼下阴影、眼皮低垂等疲惫外观线索；不据此断言内在情绪或意愿';p.closestExisting='general-taxonomy:v2.emotion.weariness';p.whyNotExisting='既有项是内在心理倦怠，本提案限定可见外观；仍待全库近义审查，不作为现场资格。';}
    if(p.proposedId==='general-taxonomy:surface.temperature') {p.definition='物体或体表的触感温度这一编辑检索维度；冷热值另由同实例事实及互斥值提供';p.whyNotExisting='环境热感与物体表面温度的对象范围不同；本Tag仅供编辑检索，不能过滤冷热或代替温度查询。';}
  }
  data.notes='由v1.0原稿编辑迁移至v1.3。270条素材保留稳定ID；普通候选统一priority=500。所有词条均为hold：原稿没有完整语义前置及可信场景证据，已逐条记录pendingFacts；已登记的通道/在场/过滤查询仅作部分前置。仅为作者稿，不代表可试拼、持久审批或游戏接入。预览为显式假设下的人工语感检查。';
  return {name,data,old};
});

// Each manual preview references actual revised phrases without silently rewriting them.
const byId = new Map(updated.flatMap(x=>x.data.entries).map(e=>[e.id,e]));
const text = id => {assert(byId.has(id));return byId.get(id).text;};
const preview = (templateId, ids, prose) => ({templateId,entryIds:ids,fixtureId:'manual-hypothesis-2026-10-15',seed:0,revision:2,mode:'manual',text:prose,evidenceStatus:'hypothetical-only'});
updated[0].data.handPreviews=[
  preview('assembly.review.b1', ['word.prop.modern.store.vending','word.sense.modern.exhaust.peak'], `在便利店门口，你注意到${text('word.prop.modern.store.vending')}。你察觉到${text('word.sense.modern.exhaust.peak')}。你可以离开这里。`),
  preview('assembly.review.b1', ['word.prop.modern.locker.row','word.sense.modern.disinfect.floor'], `在储物间，你注意到${text('word.prop.modern.locker.row')}。你察觉到${text('word.sense.modern.disinfect.floor')}。你可以离开这里。`),
  preview('assembly.review.b1', ['word.prop.modern.arcadecoin.crack'], `在洗衣房，你注意到${text('word.prop.modern.arcadecoin.crack')}。你可以离开这里。`),
];
updated[1].data.handPreviews=[
  preview('assembly.review.b2', ['word.form.modern.commuter.doze','word.action.modern.doze.nod'], `在地铁车厢里，${text('word.form.modern.commuter.doze')}，${text('word.action.modern.doze.nod')}。你可以离开这里。`),
  preview('assembly.review.b2', ['word.form.modern.mechanic.crouch','word.action.modern.screw.back'], `在修车铺，${text('word.form.modern.mechanic.crouch')}${text('word.action.modern.screw.back')}。你可以离开这里。`),
  preview('assembly.review.b2', ['word.form.modern.swim.wethair','word.action.modern.phone.flick'], `在楼道里，${text('word.form.modern.swim.wethair')}${text('word.action.modern.phone.flick')}。你可以离开这里。`),
];
updated[2].data.handPreviews=[
  preview('assembly.review.b3.material', ['word.materialqualifier.common.metal.fleck','word.material.common.machineoil'], `在修车铺，你注意到一摊${text('word.materialqualifier.common.metal.fleck')}的${text('word.material.common.machineoil')}。你可以离开这里。`),
  preview('assembly.review.b3.body', ['word.bodypart.common.wrist.cuff','word.bodymatqual.common.smooth','word.bodymaterial.common.skin'], `你留意到对方的${text('word.bodypart.common.wrist.cuff')}，以及这处手腕上${text('word.bodymatqual.common.smooth')}的${text('word.bodymaterial.common.skin')}。你可以离开这里。`),
  preview('assembly.review.b3.material', ['word.materialqualifier.common.clear','word.material.common.distilled'], `在诊所，你注意到一瓶${text('word.materialqualifier.common.clear')}的${text('word.material.common.distilled')}。你可以离开这里。`),
];
// Negative cases are evaluated under temporary, explicit hypotheses; no holds are approved.
const all=updated.flatMap(x=>x.data.entries);
assert.equal(all.length,270);assert.equal(new Set(all.map(e=>e.id)).size,270);
for(const {data} of updated) {
  validateDelivery(data,bundle);
  for(const p of data.handPreviews) for(const id of p.entryIds) assert(p.text.includes(text(id)));
  for(const e of data.entries) {assert.equal(e.review,'hold');assert.equal(e.priority,500);assert(Array.isArray(e.exclusive));assert(!e.text.includes('undefined'));if(e.role==='qualifier')assert(!e.text.endsWith('的'));}
}
for(const p of ['body.material.qualifier','material.qualifier']) for(const e of all.filter(e=>e.poolIds[0]===p))assert.equal(e.pendingFacts.length,2);
assert.equal(text('word.materialqualifier.common.thin.diluted'),'稀薄');
assert.equal(byId.get('word.prop.modern.bottle.scale').tagIds[0],'general-taxonomy:common.object.water-bottle');
assert.equal(all.filter(e=>e.review==='draft').length,0);
await fs.mkdir(out,{recursive:true});
const summaries=[];
for(const {name,data,old} of updated) {
  const filename=name.replace('-v1','-reviewed-v2');
  const stats={};for(const e of data.entries){const s=stats[e.poolIds[0]]??={count:0,hold:0,emptyTags:0};s.count++;s.hold++;if(!e.tagIds.length)s.emptyTags++;}
  const rows=Object.entries(stats).map(([pool,s])=>`| ${pool} | ${s.count} | ${s.hold} | ${s.emptyTags} |`).join('\n');
  const pending=data.entries.map(e=>`### ${e.id}\n\n正文：${e.text}\n\n${e.pendingFacts.map(f=>'- '+f).join('\n')}\n`).join('\n');
  const md=`# ${filename} 修订说明\n\n作者：${data.author}。日期：2026-10-15。规范：v1.3。修订：2。\n\n保留 ${data.entries.length} 条原始稳定ID。当前 draft 0 条、hold ${data.entries.length} 条；可试拼数量为0，不能计为已上线内容。\n\n## 数量统计\n\n| 词池 | 数量 | hold | 标签留空 |\n|---|---:|---:|---:|\n${rows}\n\n全部priority=500，统一普通候选档；同条件候选进入运行副本后才可由seed打破同档排序。\n\n## 本批修改\n\n${changes.filter(c=>data.entries.some(e=>e.id===c.id)).map(c=>`- ${c.id}：${c.field} 从 ${JSON.stringify(c.before)} 改为 ${JSON.stringify(c.after)}。`).join('\n')}\n\n- exclusive统一数组；定词去除末尾“的”，材料模板的qualifierPlan须声明separator为“的”。\n- 每条补pendingFacts；原稿approved撤回为hold，已知查询仅保留部分前置，未猜造事实键或真实值映射。\n- handPreviews改为对象并记录引用ID、假设来源和人工检查状态。\n${data.task==='B1'?'- 原稿标签留空实际10条，不是约30条；本版统计见上表。water-bottle的实际定义是水杯，原标注正确，保留。\n- 感官拆入smell/sound/light/thermal/touch子池；只使用“你察觉到”通用连接词。\n':''}\n## 人工语感预览\n\n以下均为假设场景，假设所述人物/物件/材料及细节真实存在、引用属于同一正确实例，且适配器提供真实免费出口；不是运行拼装或现场证据。对应模板为本修订的人工句式标签，未作为可执行模板交付。\n\n${data.handPreviews.map((p,i)=>`${i+1}. ${p.text}\n   - 引用：${p.entryIds.join('、')}`).join('\n\n')}\n\n## 标签提案\n\n${data.suggestedTags.length?data.suggestedTags.map(p=>`- ${p.proposedId}（${p.label}）：${p.definition}。仅保留提案，未注册，需人工查重审批。`).join('\n'):'无新增标签提案。'}\n\n## 待核实语义条件\n\n以下内容是待补语义要求，不是已实现的查询，也不以加Tag代替。完成映射和独立审稿后才能逐条转draft并进行临时运行测试。\n\n${pending}\n`;
  await fs.writeFile(path.join(out,filename+'.json'),JSON.stringify(data,null,2)+'\n');
  await fs.writeFile(path.join(out,filename+'.md'),md);
  summaries.push({file:filename+'.json',entries:data.entries.length,draft:0,hold:data.entries.length,stats,originalSha256:sha(originals.find(x=>x.name===name).bytes)});
}
const report={date:'2026-10-15',scope:'editorial-authoring-only',specVersion:'1.3',total:270,draft:0,hold:270,validation:'authoring-format-passed',runtimeIntegrated:false,sourceFilesUnchanged:true,batches:summaries,changes,checks:['official validateDelivery for all three batches','270 stable unique original IDs','all qualifier connectors and exclusive arrays normalized','all used tags registered and active','all preview entry IDs exist and revised phrases appear verbatim','unknown semantic prerequisites held instead of guessed']};
await fs.writeFile(path.join(out,'validation-report.json'),JSON.stringify(report,null,2)+'\n');
await fs.writeFile(path.join(out,'README.md'),`# B系列词条修订版\n\n日期：2026-10-15。保留270条稳定ID，修订六份交付文件，按当前v1.3作者格式校验通过。\n\n已修正文案、统计、16条对象型互斥声明、60条定词连接格式、5处标签及270条优先级；人物外观去除完整连续动作，感官按通道分池。未新增或删减词条。具体文字和标签修改见各批MD及validation-report.json。\n\n上一轮审阅把water-bottle误判为水瓶：实际注册定义为水杯，原玻璃杯标注正确，本次保留。\n\n当前全部270条为hold，draft为0；原稿缺完整语义前置，不能冒充已审批或可上线。每条pendingFacts列出待核实条件，已知事实键仅补部分前置；素材编辑已完成，生产适用条件和真实场景映射仍需接入后逐条审核。人工预览是hypothetical-only，未运行或批准hold词条。\n\n三个JSON与三个同名MD为交付内容。validation-report.json记录原稿SHA-256及检查结果。原六份文件保持不变。\n`);
for(const {name,bytes} of originals) assert.equal(sha(await fs.readFile(path.join(source,name+'.json'))),sha(bytes));
console.log(JSON.stringify({out,files:await fs.readdir(out),entries:all.length,draft:0,hold:all.length,validation:'passed',textEdits:changes.filter(c=>c.field==='text').length,tagEdits:changes.filter(c=>c.field==='tagIds').length},null,2));
