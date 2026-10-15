import {mkdir,writeFile} from 'node:fs/promises';

export async function buildPersonalityContent(){
  const empty=(id,namespace,dependencies,capabilities)=>({manifest:{id,namespace,version:'1.0.0',schemaVersion:2,engineApiVersion:'0.1',author:'Aetheria',status:'reviewed',dependencies,requiresCapabilities:capabilities,migrations:[]},variables:[],flags:[],hooks:[],locations:[],routes:[],actions:[],events:[],texts:{},contributions:[],tags:[]});
  const traits=[['noble','高傲矜持'],['shy','羞怯敏感'],['forthright','直率豪爽'],['calculating','精明务实'],['devout','虔诚克制'],['playful','狡黠活泼']];
  const shared=empty('aetheria/personality','personality',[],['foundation.v2']);
  shared.tags=traits.map(([key,label])=>({id:`personality:trait.${key}`,label,definition:'用于居民性格与交谈候选筛选的行为倾向，不授予身体、服务权限或意愿。',facets:['context'],status:'active',aliases:[]}));
  const dep=id=>({id,version:'1.0.0',optional:false});
  const p=empty('aetheria/personality-dialogue','personality-dialogue',[dep('aetheria/personality'),dep('aetheria/adventure'),dep('aetheria/fantasy-residents')],['foundation.v2','adventure.v1','condition.v1','effect.v1','district.v1']);
  p.narrativeNodes=[];
  const own=s=>'personality-dialogue:'+s,tag=key=>({role:'opponent',tagId:`personality:trait.${key}`});
  const welcome={role:'opponent',tagId:own('tag.welcome')};p.tags.push({id:welcome.tagId,label:'愿意继续交谈',definition:'绑定居民在这次交谈中明确同意继续，不代替其他范围的意愿。',facets:['context'],status:'active',aliases:[]});
  const text=(key,value)=>{const id=own('text.'+key);p.texts[id]=value;return id;};
  const present={op:'conversation.present'},time=minutes=>({op:'clock.advance',minutes}),response=reaction=>({op:'conversation.respond',reaction});
  const choice=(key,label,result,effects=[],conditions=[],next=null,setTags=[])=>({label,resultText:text(key,result),effects,conditions,setTags,unsetTags:[],next});
  const exit=key=>choice(key+'.exit','结束交谈','你结束这次交谈，继续自己的安排。');
  const variants={
    noble:['对方没有急于回应，而是先听完你的来意。谈到具体事情时，措辞格外认真。','认真说明来意，询问是否愿意继续','你的认真让对方放下了一些保留。对方明确表示愿意再聊一会儿。','你们逐渐找到共同关注的事情。对方仍重视分寸，却愿意听你的看法。','嘲弄对方讲究礼数','对方明确表示不愿继续这段交谈。你们就此结束。'],
    shy:['对方的回应不多，每次接话前都留出片刻停顿。你有时间决定交谈的节奏。','留出回应的时间，询问是否愿意继续','你没有催促。对方确认自己愿意继续，开始多说了一些近况。','交谈的停顿变得自然。对方可以慢慢说完，你也听得更清楚。','催促对方立刻回答','对方表示这种催促让自己不舒服，结束了交谈。'],
    forthright:['对方很快把话题带到眼前的事情上。态度坦率，也愿意听清你的意见。','直接说明想法，询问是否愿意继续','对方认可你把话说明白的做法，明确答应继续交流。','你们交换了各自的看法。有不同意见时，也能直接讲清原因。','轻视对方的意见','对方直接指出你的失礼，并表示今天不再继续聊。'],
    calculating:['对方先问你希望了解什么，再说明自己能够回答的范围。交谈讲究清楚和实际。','说清问题与边界，询问是否愿意继续','你把问题说得具体。对方确认愿意继续，但没有承诺未谈妥的事情。','你们把容易误会的地方逐一说清，逐渐形成了更明确的理解。','要求对方无条件为你效劳','对方拒绝了这个要求，结束了交谈。'],
    devout:['对方认真对待自己的原则，也愿意听你表达。哪些话题可以谈，始终说得清楚。','尊重对方的原则，询问是否愿意继续','你承认彼此可以保留不同看法。对方明确表示愿意继续交谈。','你们讨论各自重视的事情，没有要求谁放弃原有的原则。','贬低对方坚持的原则','对方说明自己无法接受这样的态度，结束了交谈。'],
    playful:['对方用一个轻松的问题打开话题。气氛活泼，但你仍可以认真表达或随时结束。','接住话题，询问是否愿意继续','对方欣然同意继续聊，也确认你们都可以随时结束。','玩笑之后，你们开始说起真正关心的事情。交谈轻松，也保留了彼此的分寸。','用贬低对方的玩笑取乐','对方明确说这并不好笑，随后结束了交谈。'],
  };
  for(const [key,label]of traits){
    const [intro,positive,accepted,deepen,rude,rejected]=variants[key];
    for(let variant=0;variant<2;variant++){
      const name=`${key}.start.${variant}`;
      p.narrativeNodes.push({id:own('node.'+name),kind:'conversation',stage:'start',title:`与{opponent}交谈`,textKey:text(name,`你与{opponent}在{place}开始交流。${intro}${variant?'这次话题从当天的近况展开。':'你先说明自己想聊些什么。'}`),requiresTags:[tag(key)],excludesTags:[],conditions:[],tendencies:[{tagId:tag(key).tagId,weight:3}],weight:variant?8:10,priority:10,maxVisits:1,choices:[
        choice(name+'.positive',positive,accepted,[response('welcomed'),time(10)],[present],`personality-${key}-deepen`,[welcome]),
        choice(name+'.neutral','简短交换近况后道别','你们聊完眼前的近况，平和地结束了这次交流。',[time(5)],[present]),
        choice(name+'.rude',rude,rejected,[response('offended'),time(5)],[present]),exit(name),
      ]});
    }
    const name=key+'.deepen';
    p.narrativeNodes.push({id:own('node.'+name),kind:'conversation',stage:`personality-${key}-deepen`,title:`继续与{opponent}交流`,textKey:text(name,`你和{opponent}都愿意继续这段交谈。${deepen}`),requiresTags:[tag(key),welcome],excludesTags:[],conditions:[],tendencies:[{tagId:tag(key).tagId,weight:3}],weight:10,priority:10,maxVisits:1,choices:[
      choice(name+'.finish','认真听完，结束这次交谈','你们把这次的话说完，没有把交谈当成尚未约定的任务或承诺。',[time(10)],[present]),
      choice(name+'.gift','赠送一份黑麦干粮','你留下一份黑麦干粮。{opponent}接受了这份心意，你们随后道别。',[{op:'item.consume',id:'fantasy:item.ration',amount:1},response('gift'),time(5)],[present,{op:'conversation.giftAvailable'},{op:'item.has',id:'fantasy:item.ration',comparison:'gte',value:1}]),
      choice(name+'.private','询问是否愿意更亲近地相处','你先说明自己的想法。{opponent}明确表示愿意，你们在彼此认可的分寸内度过一段安静的相处时光，随后各自继续安排。',[time(15)],[present,{op:'preference.adultOptional',value:true},{op:'conversation.adultEligible'},{op:'conversation.trust',value:2}]),exit(name),
    ]});
  }
  for(const node of p.narrativeNodes)for(const id of [node.textKey,...node.choices.map(c=>c.resultText)])if(/占位|\b(?:TODO|TBD|placeholder|stub)\b/i.test(p.texts[id]))throw Error('性格正文未完成');
  await mkdir('content/personality',{recursive:true});await writeFile('content/personality/pack.json',JSON.stringify(shared,null,2)+'\n');
  await writeFile('content/generation/personality-dialogue-content.json',JSON.stringify(p,null,2)+'\n');
  console.log(`Personality content: ${shared.tags.length} shared traits, ${p.narrativeNodes.length} completed conversation nodes.`);
}
