import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { stableJson } from '../src/core/types.ts';
import { parseQuestContent } from '../src/content/quest-schema.ts';
import { parseWorldProfiles } from '../src/world/profiles.ts';
import { themes } from '../production/quest-authoring/world-settings/themes.mjs';
import { sharedCharacters, sharedAtmosphere } from '../production/quest-authoring/neighborhoods/sides.mjs';

const digest = value => createHash('sha256').update(stableJson(value)).digest('hex');
const write = (file, value) => writeFile(file, JSON.stringify(value, null, 2) + '\n');
const choice = (id, label, result, minutes = 15, requires = [], memory = null) => ({ id, label, result, requires, minutes, energy: 0, complete: true, memory });
export async function buildWorldProfiles() {
  const profiles = [], tags = [];
  for (const row of themes) {
    const [key, sourceTheme, name, description, places, product, resource, factory, network, base, supply, forces, authority, rich, ruler, tradeFaction, powerFaction] = row;
    const source = { mainQuest: { id: `main.world_${key.replaceAll('-', '_')}`, goal: `站上顶点：在${name}成为${rich}，或成为${ruler}。`, paths: [], journal: [] }, sideQuests: [], relationRules: { types: ['colleague','neighbor','acquaintance','grudge','debt'], perResident: '1-2', usage: '复用关系类型，由生成器绑定具体成年居民；仅记录当场选择，不自动演化关系。' } };
    const execution = { stages: {}, sides: {} };
    const sideRows = [
      [`被退回的${product}`, 'market', `一批${product}被整批退回，卖方说只有部分有问题，买方不愿再承担风险。`, '把可用与待修部分分开交易', '双方当场复核分类，愿意为明确可用的部分重新签单。', '保留整批但写明折价与返修责任', '买方接受折价，卖方明确承担返修，争执有了可执行的处理记录。'],
      [`谁能使用${factory}`, 'workshop', `${factory}的空闲时段被大客户预订，新生产者只能借到零碎时间。`, '与小生产者合并时段申请', '共同申请取得连续时段，各自贡献仍单独记账。', '用维护工作换取固定试产时段', '值守人员接受维护交换，试产不再依赖临时空档。'],
      [`${network}的隐藏抽成`, 'commons', `${network}的结算单上多出一项无人说明的抽成，小供货方想直接拒付。`, '公开逐项对照原合同', '未被约定的抽成被剔除，双方接受公开后的结算版本。', '把争议部分暂存，先结清无争议部分', '供货方拿到确定收入，争议被单独保存等待裁决。'],
      [`${base}的两份通行约定`, 'workshop', `${base}的物资车辆和步行访客使用同一入口，双方都认为对方破坏了通行约定。`, '现场演练人车分时进入', '入口按演练次序重新分配，双方见证了可执行的安排。', '为访客保留连续开放的侧道', '物资通行得以继续，访客也获得不依赖临时放行的路径。'],
      [`先给谁的${supply}`, 'clinic', `${forces}希望拿走新到的${supply}，护理人员坚持必须留下当地居民的储备。`, '先保留基本救护储备再配给队伍', '双方接受固定底额，队伍领到剩余物资且不干涉救护。', '队伍分批领取并承担补回责任', '护理人员保住周转余量，队伍签下明确的补回次序。'],
      [`${authority}的旧债`, 'commons', `旧承包者以未清债务要求${forces}继续服从，账面却把同一笔费用算了两次。`, '当场核对并撤销重复计费', '重复费用被双方划除，旧债不再能被无限扩大。', '由共同托管结清争议之外的部分', '确定债务得到偿付，指挥授权与剩余争议被明确分开。'],
      [`留在${network}里的旧名`, 'commons', `有旧怨的人发现自己的贡献在${network}的公开记录中被归到你名下。`, '共同更正贡献记录', '对方记住你愿意当面纠正署名，接受不再追究这一笔旧怨。', '保留争议说明并补上两人的各自记录', '对方记住你保留了双方说法，接受以清楚边界继续相处。'],
      [`欠着一份${supply}`, 'clinic', `曾给你提供${supply}的人正在整理剩余用品，你一直没有机会还清那次人情。`, '与对方一起完成用品分类', '对方接受你当场完成的劳动，记住这次旧人情已经结清。', '帮对方制作更清楚的取用说明', '对方保留了说明，并记住你用实际帮助偿还了旧人情。'],
      [`${places[4]}里的短暂停留`, 'commons', `${places[4]}里有人刚刚离开，空位旁留着一张无字卡片。`, '把卡片压在公共留言册里', '卡片停在新的空白页，留给下一个愿意落笔的人。', '把卡片摆到空位正中', '卡片安静地留在空位上，周围声响仍在继续。'],
      [`${places[1]}的收摊声`, 'market', `${places[1]}的货箱正在合上，一只空箱的搭扣仍轻轻晃动。`, '扣好空箱搭扣', '箱盖稳住，收摊的人朝你点了点头。', '把空箱移到挡风处', '搭扣停止晃动，通道也多出一点空位。']
    ];
    const addSide = (suffix, r, type, relation, effect = null) => {
      const [title, locationType, prompt, a, ar, b, br] = r, id = `side.${suffix}`, flag = `side:flag.${suffix}`;
      source.sideQuests.push({ id, type, locationType, requiresRelation: relation, objective: prompt + ` 在当地选择：${a}，或${b}。`, flag, effectOnMain: effect, journalText: type === 'atmosphere' ? null : `在${places[['home','market','workshop','clinic','commons'].indexOf(locationType)]}处理「${title}」：${a}，或${b}。` });
      execution.sides[id] = { title, prompt, choices: [choice('a', a, ar, type === 'atmosphere' ? 1 : 10, [], relation ? ar : null), choice('b', b, br, type === 'atmosphere' ? 1 : 10, [], relation ? br : null)] };
      return flag;
    };
    const support = sideRows.slice(0,6).map((r,i) => addSide(`support_${i+1}`, r, 'main-related', null, `为${i<3?'资源经营':'权力争夺'}第${i%3+1}阶段提供额外解法；主线基础方案始终可用。`));
    sharedCharacters.forEach((r,i) => addSide(`resident_${i+1}`, r, 'character', ['neighbor','neighbor','colleague','acquaintance'][i]));
    addSide('resident_5', sideRows[6], 'character', 'grudge'); addSide('resident_6', sideRows[7], 'character', 'debt');
    [...sideRows.slice(8), ...sharedAtmosphere].forEach((r,i) => addSide(`moment_${i+1}`, r, 'atmosphere', null));
    const stageRows = [
      [`第一笔${product}生意`, 'market', `取得一份可以持续结算的${product}供货契约`, '亲自验货，以明确的返修责任换取供货署名', '联合小供货方，把零散订单合成一份长期契约'],
      [`掌握${factory}`, 'workshop', `取得${factory}的固定生产与交付权限`, '完成试产，按交付成果分成换取固定产能', '接管闲置设备，以承担维护换取独立生产时段'],
      [`控制${network}`, 'commons', `取得${network}的主要结算与资源分配权`, `以供货与产能担保重组旧债，换取${resource}的优先调配权`, '联合独立经营者集中表决授权，接管共同结算'],
      [`${rich}的最后一笔交易`, 'home', `完成${network}的实际控制权转移，成为${rich}`, '承担旧债与经营责任，接管统一控制权', '保留小供货方的独立经营权，以控股联盟接掌网络'],
      [`把${base}变成你的据点`, 'workshop', `取得${base}的独立调度与防卫授权`, '恢复据点的控制设备，在现场完成接管演示', '与原值守者达成互保约定，以承担防卫取得据点'],
      [`让${forces}留下来`, 'clinic', `落实${forces}的持续补给与救护协议`, `与护理人员划清${supply}底额，签下持续补给约定`, '接受较少初期配额，用轮值护送换取稳定补给'],
      [`夺取${authority}的主动权`, 'commons', `取得${authority}的统一防卫指挥授权`, '以已控制的据点与补给提出接管条件，集中指挥权', '公开挑战旧指挥方案，以现场演练赢得各队授权'],
      [`${ruler}的控制席`, 'home', `接管${authority}并落实各据点的服从约定，成为${ruler}`, '签署统一防卫令，直接掌握最高指挥权', '保留各队内部事务权，以共同防卫协议取得最高指挥权']
    ];
    for (const [route, routeKey] of ['resource','stewardship'].entries()) {
      const stages = stageRows.slice(route*4,route*4+4).map(([title,locationType,milestone,a,b],i) => {
        const id = `${routeKey}_s${i+1}`, flag = i===3?'main:flag.top_reached':`main:flag.${routeKey}.${i+1}`;
        const outcome = action => `你${action}。${milestone}。${i===3?`你以${route? ruler:rich}的身份站上顶点。`:'这项权利已由现场各方确认。'}`;
        const choices = [choice('a',a,outcome(a),20),choice('b',b,outcome(b),25)];
        if(i<3)choices.push(choice('supported',`采用「${sideRows[route*3+i][0]}」的处理记录`, `你用已确认的处理记录解决了本次谈判中的争议，随后完成现场交接。${milestone}。`,10,[support[route*3+i]]));
        execution.stages[id]=choices;
        return {id,name:title,locationType,objective:`${milestone}。${i===3?'控制权必须完成实际交接。':'需要当场落实约定，传闻或口头承诺不算完成。'}`,flag,actions:choices.map(c=>c.label),requires:[i===0?'main:flag.started':`main:flag.${routeKey}.${i}`],next:i===3?[]:[`${routeKey}_s${i+2}`]};
      });
      source.mainQuest.paths.push({id:`path.${routeKey}`,style:`${route?'权力争夺':'资源经营'}：成为${route?ruler:rich}`,stages});
      stages.slice(0,-1).forEach((s,i)=>source.mainQuest.journal.push({unlockFlag:s.flag,text:stages[i+1].objective}));
    }
    source.mainQuest.journal.unshift({unlockFlag:'main:flag.started',text:source.mainQuest.goal});
    source.mainQuest.journal.push({unlockFlag:'main:flag.top_reached',text:'你已取得这个世界的最高地位，未完成的当地事务仍可继续。'});
    const quests=parseQuestContent({format:'aetheria-quest-content',schemaVersion:1,id:`aetheria/world-${key}-apex`,version:'1.0.0',sourceHash:digest(source),source,execution});
    const locations={};
    const economies=['生活补给',`${product}交易`,`${product}生产`,`${supply}整理`,'公共事务协调'];
    const details=[`${base}附近的生活区提供住处与日常补给。`,`${product}的报价与交易凭据摆在公开台面上，${resource}的去向是常见争论。`,`${factory}的设备区与公共接单区分开，${product}在这里生产和修复。`,`${supply}与恢复座位分区摆放，${forces}的配给不能排挤日常救护。`,`${authority}的公开联络处设在这里，${network}的争议也有人受理。`];
    const professionLabels = key === 'xianxia' ? ['客舍管事','灵材商人','机关炼器师','丹药医师','宗门执事'] : key === 'western' ? ['旅馆管理员','货运经纪','机车技师','边境医生','镇务文员'] : ['住区管理员','交易经纪人','设备技师','护理人员','公共事务联络人'];
    ['home','market','workshop','clinic','commons'].forEach((service,i)=>locations[service]={names:[places[i],`${places[i]}·附区`],description:details[i],economy:[economies[i]],professions:[professionLabels[i]]});
    const tag=`worlds:setting.${key}`;
    const aliases=[key,...({floating:['sky'],polar:['snowfield'],volcanic:['lava'],harbor:['ship'],desert:['gobi'],dungeon:['grave']}[key]??[])];
    tags.push({id:tag,label:sourceTheme,definition:`当前世界题材为${sourceTheme}；与湿润、干燥等生态独立。`,facets:['setting'],status:'active',aliases:aliases.map(k=>({scope:'generation.v1',value:`general-taxonomy:setting.${k}`}))});
    profiles.push({id:`world.${key}`,tag,name,version:'1.0.0',description,sourceTheme,residentNames:key==='xianxia'?['林舟','沈青','叶宁','顾尘','苏禾','陆遥']:['莱娜','凯恩','米拉','洛根','艾达','诺亚'],locations,factions:[{name:tradeFaction,activities:[`${product}贸易`,`${resource}调配`]},{name:powerFaction,activities:[`${forces}联络`,'公共救护协作']}],quests});
    const dir=`production/quest-authoring/world-settings/${key}`;await mkdir(dir,{recursive:true});await write(`${dir}/quest-tree.json`,source);await write(`${dir}/execution.json`,execution);
  }
  const catalog={format:'aetheria-world-profiles',schemaVersion:1,profiles};parseWorldProfiles(catalog);
  await write('content/generation/world-profiles.json',catalog);
  await write('content/generation/world-profile-content.json',{manifest:{id:'aetheria/world-settings',namespace:'worlds',version:'1.0.0',schemaVersion:2,engineApiVersion:'0.1',author:'Aetheria world profile authoring',status:'reviewed',dependencies:[{id:'aetheria/foundation',version:'1.0.0',optional:false}],requiresCapabilities:['foundation.v2'],migrations:[]},variables:[],flags:[],hooks:[],locations:[],routes:[],actions:[],events:[],texts:{},contributions:[],tags});
  console.log(`World profiles: ${profiles.length} world Tags; shared services, themed places, organizations and quest graphs (18 side entries per world).`);
}
