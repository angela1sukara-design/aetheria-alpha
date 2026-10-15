import{readdir,readFile,writeFile}from'node:fs/promises';import path from'node:path';import{createRequire}from'node:module';
const require=createRequire(import.meta.url);
let transpile;
try{
  const ts=await import('typescript');
  transpile=(source,file)=>ts.default.transpileModule(source,{fileName:file,compilerOptions:{target:ts.default.ScriptTarget.ES2022,module:ts.default.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
}catch{
  const babel=require('/usr/share/nodejs/@babel/core');
  const presetTs=require('/usr/share/nodejs/@babel/preset-typescript');
  const presetEnv=require('/usr/share/nodejs/@babel/preset-env');
  transpile=(source,file)=>babel.transformSync(source,{filename:file,presets:[[presetTs,{allowDeclareFields:true}],[presetEnv,{targets:{node:'18'},modules:'commonjs'}]],sourceMaps:false}).code;
}
const sources=[];async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const file=dir+'/'+e.name;if(e.isDirectory())await walk(file);else if(e.name.endsWith('.ts'))sources.push(file);}}await walk('src');
const modules=[];
for(const file of sources){let source=await readFile(file,'utf8');source=source.replaceAll('import.meta.url','document.baseURI');const compiled=transpile(source,file);modules.push(`${JSON.stringify(file)}:function(module,exports,require){\n${compiled}\n}`);}
const index=JSON.parse(await readFile('content/index.json','utf8'));const packs=await Promise.all(index.packs.map(async f=>JSON.parse(await readFile(path.join('content',f),'utf8'))));const journal=JSON.parse(await readFile('content/journal.json','utf8'));
const worldProfiles=JSON.parse(await readFile('content/generation/world-profiles.json','utf8'));
const generation={worldProfiles,rules:JSON.parse(await readFile('content/generation/rules.json','utf8')),reference:[JSON.parse(await readFile('content/generation/lexicon-reference.json','utf8')),JSON.parse(await readFile('content/generation/fantasy-reference.json','utf8'))],content:[JSON.parse(await readFile('content/personality/pack.json','utf8')),...await Promise.all(['neighborhood-content','lexicon-content','world-profile-content','fantasy-content','personality-dialogue-content'].map(async name=>JSON.parse(await readFile(`content/generation/${name}.json`,'utf8'))))]};
const script=`globalThis.aetheriaEmbedded=${JSON.stringify({packs,journal,generation}).replaceAll('<','\\u003c')};\nconst mods={${modules.join(',\n')}};const cache={};function load(id){if(cache[id])return cache[id].exports;if(!mods[id])throw Error('Missing module '+id);const module={exports:{}};cache[id]=module;mods[id](module,module.exports,ref=>{const parts=(id.slice(0,id.lastIndexOf('/')+1)+ref).split('/'),out=[];for(const part of parts){if(part==='..')out.pop();else if(part!=='.')out.push(part);}return load(out.join('/'));});return module.exports;}load('src/ui/main.ts');`;
let html=await readFile('index.html','utf8');
html=html.replace('<link rel="stylesheet" href="./src/ui/game.css">',`<style>${await readFile('src/ui/game.css','utf8')}</style>`).replace('<script type="module" src="./src/ui/main.ts"></script>','');
// 内联普通脚本没有 module 的延迟执行语义，必须放在全部对话框之后。
html=html.replace('</body>',()=>`<script>${script.replace(/<\/script/gi,'<\\/script')}</script>\n</body>`);
await writeFile('dist/Aetheria-Alpha-0.2.html',html);
await writeFile('dist/Aetheria-Folio.html',html);
await writeFile('启动游戏-双击直接运行.html',html);
console.log('Standalone offline HTML built: dist/Aetheria-Folio.html (legacy entry preserved).');
