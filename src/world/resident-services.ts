import type { ContentPack, Id } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import { purchasePrice } from '../engine/progression.ts';

/** 把已声明但没有旧全局入口的货物编译成普通动作，存档保存定义而非临时 UI 按钮。 */
export function compileResidentServices(pack:ContentPack,source:Registry):void {
  const stock=[...new Set(pack.residentTemplates?.flatMap(t=>t.services?.trade??[])??[])].sort();
  const existing=source.globalActions().flatMap(a=>a.effects.filter(e=>e.op==='progression.act'&&e.move==='buy').map(e=>e.op==='progression.act'?e.id:undefined));
  const custom=stock.filter(id=>!existing.includes(id));if(!custom.length)return;
  if(!pack.manifest.requiresCapabilities.includes('hook.global.v1'))pack.manifest.requiresCapabilities.push('hook.global.v1');
  const hook='worldgen:hook.resident-services' as Id;
  pack.hooks.push({id:hook,accepts:'action',visibility:'public'});(pack.globalActionHooks??=[]).push(hook);
  const actionIds:Id[]=[];
  for(const [index,id]of custom.entries()){
    const item=source.items.find(i=>i.id===id),gear=source.equipment.find(i=>i.id===id);
    if(!item&&!gear)throw Error(`商店引用了不存在的商品：${id}`);
    const name=(item??gear)!.name,buy=`worldgen:action.buy.stock.${index}` as Id,text=`worldgen:text.buy.stock.${index}` as Id;
    pack.texts[text]=`你选好${name}，按标价付清钱款。`;
    pack.actions.push({id:buy,label:`购买${name}`,hint:`${purchasePrice(source,id)}币 · 10分钟`,group:'daily',conditions:[{op:'service.available',subject:'resident',service:'trade',id}],effects:[{op:'progression.act',move:'buy',id}],resultText:text});actionIds.push(buy);
    if(item){
      const use=`worldgen:action.use.stock.${index}` as Id,useText=`worldgen:text.use.stock.${index}` as Id;
      pack.texts[useText]=item.description;
      pack.actions.push({id:use,label:`使用${name}`,hint:'5分钟 · 消耗一份',group:'daily',conditions:[{op:'item.has',id,comparison:'gte',value:1}],effects:[{op:'item.use',id}],resultText:useText});actionIds.push(use);
    }
  }
  pack.contributions.push({hookId:hook,actionIds});
}
