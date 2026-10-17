/** 五间房测试用的名字、标签和现场正文。不读取原工程的内容包。 */

export const FETISHES = [
  ['coating', '覆层'],
  ['restraint', '束缚'],
  ['penetration', '侵入'],
  ['sensory', '感官剥夺'],
  ['oviposition', '产卵寄宿'],
  ['humiliation', '羞辱'],
  ['domination', '调教'],
  ['swarm', '围攻'],
];

export const TRAITS = [
  ['noble', '高傲矜持'],
  ['shy', '羞怯敏感'],
  ['forthright', '直率豪爽'],
  ['calculating', '精明务实'],
  ['devout', '虔诚克制'],
  ['playful', '狡黠活泼'],
];

export const RELATIONS = [
  ['colleague', '同事'],
  ['neighbor', '邻居'],
  ['acquaintance', '熟人'],
  ['grudge', '旧怨'],
  ['debt', '人情债'],
];

export const CAPABILITIES = [
  ['grasp', '抓握'],
  ['walk', '行走'],
  ['hear', '听觉'],
  ['balance', '平衡'],
  ['tailGrip', '尾部抓握'],
];

export const MATERIALS = [
  ['organic', '有机'],
  ['mechanical', '机械'],
];

export const PLAYER_NAMES = ['阿洛', '沈渡', '季衡', '宋晚', '顾迟', '宁小舟'];
export const KEEPER_NAMES = ['老闸', '阿苓', '守夜人'];
export const SMITH_NAMES = ['霍匠', '柜上的人', '铁柜台'];

export const LABEL = Object.fromEntries([
  ...FETISHES, ...TRAITS, ...RELATIONS, ...CAPABILITIES, ...MATERIALS,
]);

export const COAT_LABEL = {
  slime: '黏液覆层',
  bind: '束痕',
  cocoon: '结茧痕',
  saliva: '颈侧涎痕',
  seal: '封口痕',
};

export const MONSTERS = {
  slime: {
    id: 'slime', name: '沼史莱姆', fetish: 'coating', coat: 'slime', room: 'mud',
    finisher: '把干燥的盐拍进它的膜',
    hidden: ['史莱姆', '盐'],
  },
  vine: {
    id: 'vine', name: '暗渠藤蔓', fetish: 'restraint', coat: 'bind', room: 'mud',
    finisher: '砍断主根',
    hidden: ['藤', '主根'],
  },
  crawler: {
    id: 'crawler', name: '虫巢爬行者', fetish: 'oviposition', coat: 'cocoon', room: 'pump',
    finisher: '撕开贴在腰侧的虫群',
    hidden: ['虫', '茧'],
  },
  wolf: {
    id: 'wolf', name: '兽径涎狼', fetish: 'humiliation', coat: 'saliva', room: 'pump',
    finisher: '砸它的鼻梁',
    hidden: ['狼', '鼻梁', '涎'],
  },
  boss: {
    id: 'boss', name: '黑胶守卫', fetish: 'domination', coat: 'seal', room: 'boss',
    finisher: '在它下令前咬破脸上的膜',
    hidden: ['黑胶', '守卫', '口令'],
  },
};

const TRAIT_LINE = {
  noble: '对方把话说得很慢，像在衡量你配不配站在这儿。',
  shy: '对方躲开你的目光，声音压得很低。',
  forthright: '对方看着你，不绕弯。',
  calculating: '对方先看了一眼你的钱袋。',
  devout: '对方把双手收在身前，像守着一条不肯破的界。',
  playful: '对方嘴角动了动，像已经想好怎么捉弄你。',
};

const RELATION_LINE = {
  colleague: '你被当成还会一起干活的人。',
  neighbor: '对方侧过身，把门口让出来。',
  acquaintance: '对方只点了一下头。',
  grudge: '对方盯着你，像还记着一笔没算完的旧账。',
  debt: '对方顿了顿，像想起你欠下的那份人情。',
};

export function label(id) {
  return LABEL[id] ?? id;
}

export function monster(id) {
  return MONSTERS[id];
}

export function bodyBits(player) {
  const bits = [];
  if (player.hands === 'gel') bits.push('你的手还在自己收紧，像一句没说完的口令。');
  else if (player.hands === 'slime') bits.push('你的手是透的，指缝里连着细丝。');
  if (player.arm === 'vine') bits.push('一条藤从你的袖口里探出来，还在慢慢找着力点。');
  if (player.ears === 'wolf') bits.push('一对狼耳正朝着门口转。');
  else if (player.ears === 'antenna') bits.push('头顶的触角抖了一下。');
  if (player.tail === 'organic') bits.push('一条长尾在你腿后慢慢摆。');
  for (const coat of player.coatings) {
    if (coat === 'slime') bits.push('小腿上还挂着没干的黏液。');
    if (coat === 'bind') bits.push('手腕上留着勒出来的束痕。');
    if (coat === 'cocoon') bits.push('腰侧沾着没撕干净的丝茧。');
    if (coat === 'saliva') bits.push('颈侧那块牙印还是湿的。');
    if (coat === 'seal') bits.push('嘴唇边缘还贴着一块会动的膜。');
  }
  return bits;
}

export function personLine(npc) {
  return `${npc.name}在这里。${TRAIT_LINE[npc.trait]}${RELATION_LINE[npc.relation]}`;
}

export function keeperSee(npc, player) {
  const bits = bodyBits(player);
  if (!bits.length) return `落脚点的灯还亮着。${personLine(npc)}`;
  return `你一进门，${npc.name}的目光就停在你身上。${bits.join('')}`;
}

export function smithSee(npc, player) {
  const bits = bodyBits(player);
  if (!bits.length) return `工坊的柜台擦得很亮。${personLine(npc)}`;
  return `${npc.name}的手停在柜台上方。${bits.join('')}`;
}

export function rumor(which) {
  if (which === 'mud') return '看管人只说前面很潮，地面会吞脚。里面的东西要么蹭上来，要么往手腕上勒。对方没说那是什么，也没说该打哪里。';
  if (which === 'pump') return '店主说泵站里守着还能用的零件。有的成群贴上来，有的会追出门口。再往里有一扇今天不该空手推开的门。名字和打法都没讲。';
  return '店主看着最里面那扇门的方向，只说门后的东西会等你自己把嘴闭上。护具有用。别的不肯讲。';
}

export function meet(id, player) {
  if (id === 'slime') return '积水中央鼓起一只半透明的身体，边缘已经贴上你的小腿，还在往上爬。';
  if (id === 'vine') return '渠壁上的藤条自己收紧，湿冷的尖端探向你的手腕。';
  if (id === 'crawler') return '泵机底下爬出一串甲壳。它们贴着地面围上来，腰侧的气口对着你。';
  if (id === 'wolf') {
    const heard = player.ears === 'wolf' || player.capability === 'hear';
    return `${heard ? '你先听见爪子踩水，然后才看见它。' : ''}铁架后面，一只狼高的野兽低下头，口涎滴进你脚前的水洼。`;
  }
  const joint = player.material === 'mechanical' ? '黑胶顺着你机械关节的缝往里看。' : '黑胶悬在你嘴唇前面，随着你的呼吸轻轻鼓起。';
  return `门后的人形把胸口的黑胶剥开。${joint}它没有扑上来，只是在等你。`;
}

export function grapple(id, player) {
  if (id === 'vine' && player.arm === 'vine') return '藤条勒上你那条藤肢，两股藤碰到一起，勒势自己松了。';
  if (id === 'boss' && player.hands === 'gel') return '黑胶贴上你的黑胶手，停了一停，像认出同一层皮。';
  if (id === 'crawler' && player.ears === 'antenna') return '你的触角先颤了一下。虫群因此露出一条缝，腰还没被按死。';
  if (id === 'slime') return '黏液顺着小腿往上糊，脚底开始打滑，小腿已经被包住一半。';
  if (id === 'vine') return '藤条缠上你的手腕，往渠壁上勒，手指开始发麻。';
  if (id === 'crawler') return '虫群按住你的腰，丝沾上衣料，腿被固定在泵机边上。';
  if (id === 'wolf') return '它的前爪按住你的肩胛，牙齿碰到颈侧，呼出的气是热的。';
  return '黑胶贴上你的嘴唇，把下一口呼吸封在外面。另一截已经牵住你的手腕。它还没下令。';
}

export function defeatOpen(id, leaned) {
  const lean = leaned ? '你刚才顺着那股劲靠了过去，所以这一下来得更顺。' : '';
  if (id === 'slime') return `${lean}你滑进积水里。半透明的身体覆上来，小腿上的黏液还在往上爬。`;
  if (id === 'vine') return `${lean}你的背抵住渠壁。藤条把两只手腕勒在一起，束痕已经陷进皮肤。`;
  if (id === 'crawler') return `${lean}甲壳压住你的腰。丝一层层缠上来，结茧还没合拢。`;
  if (id === 'wolf') return `${lean}你被压在泵房地上。颈侧又热又湿，牙齿还停在刚才咬住的地方。`;
  return `${lean}你跪在门后的积水里。黑胶贴着嘴唇，它在等你自己把嘴闭上。`;
}

export function fallScript(id, step, player) {
  if (id === 'slime') {
    if (step === 0) return '黏液漫过你的手腕，手指开始发透。它可以停在这里，也可以继续，直到这双手不再是原来的形状。';
    return '细丝把五指连在一起。再点头，这双手就会换成史莱姆手，洗不掉。';
  }
  if (id === 'vine') {
    if (step === 0) return '藤从袖口往里长，沿着你的小臂找骨缝。你可以把它扯断，也可以让它接上这条手臂。';
    return '藤肢的纹路已经盖过原来的皮肤。点头之后，这条手臂就留下来。';
  }
  if (id === 'crawler') {
    if (step === 0) return '一根柔软的触须碰到你的太阳穴，头皮底下跟着一跳。茧还缠在腰上，真正要变的是耳朵的位置。';
    return '触角顶开头发。点头，它们就长住；偏开头，就只剩腰上的茧。';
  }
  if (id === 'wolf') {
    if (step === 0) return '狼的体重把你固定在地上。舌面反复抹过颈侧的牙印，热气喷在你的喉管上。它没把你变成一滩黏液，它在等你把脖子侧得更开。';
    return '你的耳廓开始发烫，尾椎后面也在顶。点头，狼耳和长尾会留下来；推开它的嘴，就只带走这块涎痕。';
  }
  if (step === 0) return '黑胶悬在你嘴唇上。它没有动手，只等你自己把嘴闭上，或者咬破这层膜逃回去。';
  if (step === 1) {
    if (player.armor) return '膜已经连到手腕。它要你把刚买的护具摘下来，放到它脚边。摘了，黑胶就顺着小臂往上封；不摘，它就从护具的缝里挤进去。';
    return '你身上没有护具。它让你把空手按到脚边的积水里，或者把手收回去。两条路都会继续往上封，只是你的手还是不是自己的，留到最后再定。';
  }
  return '封口完成之前它停住了。点头，黑胶才会漫过剩下的手，把它们换成黑胶手。现在挣开，就只带着已经贴上的那一层回落脚点。';
}
