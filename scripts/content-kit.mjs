export function kit(p){
 const id=s=>`district:${s}`;
 const text=(key,s)=>{p.texts[id('text.'+key)]=s;return id('text.'+key);};
 const flag=key=>{const i=id('flag.'+key);if(!p.flags.some(f=>f.id===i))p.flags.push({id:i,initial:false});return i;};
 const has=(key,value=true)=>({op:'flag.has',id:flag(key),value});
 const set=(key,value=true)=>({op:'flag.set',id:flag(key),value});
 const change=(key,amount)=>({op:'var.change',id:key.includes(':')?key:`core:${key}`,amount});
 const time=minutes=>({op:'clock.advance',minutes});
 const hooks=new Map(p.locations.map(l=>[l.id,l.actionHook]));
 const add=(h,a)=>{let c=p.contributions.find(c=>c.hookId===h);if(!c)p.contributions.push(c={hookId:h,actionIds:[]});c.actionIds.push(a);};
 const action=(key,label,prose,effects,conditions=[],h=null,context=null,group='daily')=>{const a={id:id('action.'+key),label,hint:'选择会推进经历 · 查看行动反馈',group,conditions,effects,resultText:text(key,prose)};if(context)a.context=context;if(h)add(h,a.id);p.actions.push(a);return a.id;};
 const graph=(key,nodes,participants=[])=>{const e={id:id('event.'+key),startNode:nodes[0].id,nodes:[],...(participants.length?{participantIds:participants}:{})};for(const n of nodes){const node={id:n.id,type:n.exit?'exit':'choice',textVariants:[text('event.'+key+'.'+n.id,n.text)],actionIds:[],onEnter:n.exit?[{op:'event.exit'}]:n.onEnter??[]};for(const [i,ch]of (n.choices??[]).entries()){const aid=action(`event.${key}.${n.id}.${i}`,ch.label,ch.result??'你做出了选择。',[...(ch.effects??[]),{op:'event.advance',nodeId:ch.to}],ch.conditions??[],null,{eventId:e.id,nodeId:n.id},'event');node.actionIds.push(aid);}e.nodes.push(node);}p.events.push(e);return e.id;};
 const go=(label,to,effects=[],conditions=[],result)=>({label,to,effects,conditions,result});
 return {id,text,flag,has,set,change,time,hooks,add,action,graph,go};
}
