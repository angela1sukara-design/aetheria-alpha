// 显式编辑的名/姓池；不通过猜测截取旧全名来制造家族身份。
const westernGiven=['Elena','Marcus','Aiko','Noah','Sera','Kai','Quinn','Ravi','Mira','Ada','Rowan','Lyra'];
const culture=(id,familyNames,order='given-family',separator='·')=>({id,familyNames,order,separator,defaultInheritance:'parentA'});
const cosmopolitan=culture('cosmopolitan',['Vale','Reed','Mori','Chen','Stone','Rao','Hayes','Wells','Park','Grey','Lane','Brook']);
const chinese=culture('xianxia',['林','沈','叶','苏','顾','陆','裴','贺','温','方','慕容','司徒'],'family-given','');
const fantasy=culture('fantasy',['Ashvale','Thornfield','Greybrook','Ironwood','Rivermere','Stoneford','Oakheart','Dawnridge']);
export const fantasyResidentCulture=culture('fantasy-local',['灰谷','荆原','河湾','铁杉','石津','橡心','晨岭','鹿溪']);
const desert=culture('desert',['Nadir','Azhar','Sahil','Rahil','Qamar','Bahir','Nasir','Hadi']);
const western=culture('frontier',['Reed','Hayes','Stone','Wells','Brooks','Carter','Lane','West']);
export function nameProfile(key){
 const keys=['cyberpunk','post-apocalypse','space-station','desert','floating','volcanic','underground','polar','jungle','steampunk','xianxia','underwater','fantasy','modern','harbor','dungeon','western'];
 if(!keys.includes(key))throw Error('新世界必须显式编辑命名文化：'+key);
 return structuredClone(key==='xianxia'?{residentNames:['舟','青','宁','禾','知远','清岚','星河','景行','桐溪','晏秋','云舒','明澈'],nameCulture:chinese}:key==='fantasy'?{residentNames:['Elena','Gareth','Isolde','Rowan','Sable','Kai','Mira','Thorne','Quinn','Lyra'],nameCulture:fantasy}:key==='desert'?{residentNames:['Zara','Samir','Layla','Amir','Nura','Rami','Salma','Tariq','Mina','Farid'],nameCulture:desert}:{residentNames:westernGiven,nameCulture:key==='western'?western:cosmopolitan});
}
