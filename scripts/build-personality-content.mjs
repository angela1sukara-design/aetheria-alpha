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
    noble:['对方端正地停下脚步，目光沉静地听你把话说完。哪怕只是谈起日常小事，神色间也透着一股不敷衍的认真。','以相称的礼数说明来意，请教对方的看法','见你言辞得体、态度诚恳，对方微微颔首，眉宇间的疏离淡去了几分，示意不妨再多聊片刻。','话匣子慢慢打开后，你们聊起了彼此近来留心的见闻。对方依然看重分寸，却已十分乐意倾听你的见解。','出言讥讽对方过于端着架子','对方神色微敛，淡淡表示彼此话不投机，随即颔首告辞。'],
    shy:['对方听你开口时略微垂下眼帘，每次接话前都会轻轻吸一口气，声音不高，却在认真斟酌词句。','放缓语速，给对方留出从容接话的空档','察觉到你没有半点催促的意思，对方紧绷的肩膀慢慢放松下来，小声同你说起了这两天的近况。','交谈的节奏变得温和而自然。哪怕中间偶有安静的停顿，也不让人觉得局促，对方眼中多了几分安心。','不耐烦地催促对方快点把话说完','对方被突如其来的催促惊得退后半步，低声说了句失陪，匆匆结束了交谈。'],
    forthright:['对方爽快地停下手头的活计，开门见山地问你今天有什么新鲜事，眼神明亮而坦率。','直截了当地说出自己的想法与打算','对方朗声一笑，很欣赏你不绕弯子的脾气，当即拍了拍衣袖邀你接着往下聊。','你们痛快地交换了对眼下局势的看法。就算偶有不同主张，也能敞开天窗说亮话，越聊越投机。','敷衍轻慢地打断对方的直白建议','对方眉头一皱，直言不喜欢这种敷衍应付的腔调，摆摆手表示今天到此为止。'],
    calculating:['对方一边整理手边的物件，一边温和而干脆地问起你的来意，言谈间条理分明，从不轻率许诺。','把想打听的事和盘托出，讲明彼此的界限','见你是个明白事理的人，对方眼中露出赞许之色，放下手头杂务与你细聊起来。','你们把来龙去脉逐一理顺，没有半句虚浮的客套，却在彼此心里立下了踏实的信誉。','强行要求对方无偿替你办妥难事','对方平静地合上手头的册子，直言这笔账算不通，客气而坚决地送客道别。'],
    devout:['对方神色温和而克制，举手投足间守着一贯的行事准则，在听你说话时目光始终专注。','尊重对方的行事准则，温和地展开话题','感受到你的理解与尊重，对方轻轻欠身致意，语调平和地与你聊起了心中的坚持。','你们静下心来谈起各自珍视的信条，虽经历不同，却在这份纯粹的坦诚里生出了几分惺惺相惜。','出言轻慢对方一直坚守的信念','对方摇了摇头，平静地表示此事不可轻侮，随后向你礼貌告退。'],
    playful:['对方眨了眨眼，先用一句俏皮的闲话打趣了今天的天气，把周遭沉闷的气氛一下子带得活络起来。','笑着接住对方的话头，顺势聊下去','对方眉眼弯弯地笑了起来，饶有兴致地邀你坐下再聊几句街坊趣闻。','几句玩笑过后，话题自然而然转到了彼此真正挂心的日常上。气氛轻松惬意，又恰到好处地留着体面。','拿刻薄的玩笑去试探对方的底线','对方收起笑容，直言这种玩笑并不好笑，随即转身结束了交谈。'],
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
      choice(name+'.finish','认真听完，温和道别','你们把眼下的话从容聊透，彼此心照不宣地点头道别，留待日后再叙。',[time(10)],[present]),
      choice(name+'.gift','赠送一份黑麦干粮','你留下一份黑麦干粮。{opponent}接受了这份心意，你们随后道别。',[{op:'item.consume',id:'fantasy:item.ration',amount:1},response('gift'),time(5)],[present,{op:'conversation.giftAvailable'},{op:'item.has',id:'fantasy:item.ration',comparison:'gte',value:1}]),
      choice(name+'.private','询问是否愿意更亲近地独处片刻','你轻声道出心意。{opponent}微微笑着应允，与你在安静的角落里贴近彼此、共度了一段温存而笃定的时光，随后才恋恋不舍地道别。',[time(15)],[present,{op:'preference.adultOptional',value:true},{op:'conversation.adultEligible'},{op:'conversation.trust',value:2}]),exit(name),
    ]});
  }
  for(const node of p.narrativeNodes)for(const id of [node.textKey,...node.choices.map(c=>c.resultText)])if(/占位|\b(?:TODO|TBD|placeholder|stub)\b/i.test(p.texts[id]))throw Error('性格正文未完成');
  await mkdir('content/personality',{recursive:true});await writeFile('content/personality/pack.json',JSON.stringify(shared,null,2)+'\n');
  await writeFile('content/generation/personality-dialogue-content.json',JSON.stringify(p,null,2)+'\n');
  console.log(`Personality content: ${shared.tags.length} shared traits, ${p.narrativeNodes.length} completed conversation nodes.`);
}
