import { validateSemanticBatch, dictionaryRegistry } from './semantic-format.mjs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';
import { catalog } from './catalog.mjs';
import { readBatch, collection, duplicateReport, assign, extend, importBatch, applyReview, exportReviewed, rebuildIndex, atomicJSON, contextSummary, assignScope, readDelivery, importDelivery } from './library.mjs';
import { inventory } from './inventory.mjs';
import { taskPrompt } from './prepare.mjs';
import { wholePrompt } from './whole-pack.mjs';
const project=fileURLToPath(new URL('../../',import.meta.url));
const root=path.join(project,'production','lexicon-authoring');
const [command,...args]=process.argv.slice(2);
function requireArgs(n) {if(args.length!==n)throw Error(`此操作需要 ${n} 个参数；含空格的参数需加引号。`);}
try {
 let result;
 switch(command) {
  case 'validate-v2': requireArgs(1); {const r=await dictionaryRegistry(project),b=validateSemanticBatch(JSON.parse(await readFile(path.resolve(args[0]),'utf8')),r);result={valid:true,format:b.format,batchId:b.batchId,count:b.entries.length,review:'unreviewed',runtime:'not-installed'};break;}
  case 'validate': requireArgs(1); {const b=await readBatch(path.resolve(args[0])),report=duplicateReport(b.entries);if(report.exact.length)throw Error('本批有精确重复：'+JSON.stringify(report.exact));result={valid:true,batchId:b.batchId,count:b.entries.length,duplicates:report};break;}
  case 'assign-scope': requireArgs(2); {result=await assignScope(root,...args);const file=path.join(root,'outbox',`whole-${args[0]}.md`);await writeFile(file,wholePrompt(...args),'utf8');result.prompt=file;break;}
  case 'validate-delivery': requireArgs(1); {const d=await readDelivery(path.resolve(args[0])),report=duplicateReport(d.batches.flatMap(b=>b.entries));if(report.exact.length)throw Error('整包有精确重复：'+JSON.stringify(report.exact.slice(0,10)));result={valid:true,scope:d.scope,batches:d.batches.length,entries:d.batches.reduce((n,b)=>n+b.entries.length,0),duplicates:report};break;}
  case 'import-delivery': requireArgs(1); result=await importDelivery(root,path.resolve(args[0]));break;
  case 'assign': requireArgs(2); {result=await assign(root,...args);const file=path.join(root,'outbox',result.batchId+'.md');await writeFile(file,taskPrompt(catalog.find(c=>c.code===result.library),result),'utf8');result.prompt=file;await rebuildIndex(root);break;}
  case 'extend': requireArgs(3); {result=await extend(root,...args);const file=path.join(root,'outbox',result.batchId+'.md');await writeFile(file,taskPrompt(catalog.find(c=>c.code===result.library),result),'utf8');result.prompt=file;await rebuildIndex(root);break;}
  case 'import': requireArgs(1); result=await importBatch(root,path.resolve(args[0]));break;
  case 'review': requireArgs(1); result=await applyReview(root,path.resolve(args[0]));break;
  case 'duplicates': requireArgs(0); result=duplicateReport((await collection(root)).entries);await atomicJSON(path.join(root,'management','duplicate-report.json'),result);break;
  case 'index': requireArgs(0); {const index=await rebuildIndex(root);result={totals:index.totals,tasks:index.tasks.length,unassigned:index.tasks.filter(t=>t.status==='unassigned').length};break;}
  case 'context': requireArgs(1); result=await contextSummary(root,args[0]);break;
  case 'export': requireArgs(1); result=await exportReviewed(root,path.resolve(args[0]));break;
  case 'inventory': requireArgs(0); {const report=await inventory(project);await atomicJSON(path.join(root,'inventory','current-materials.json'),report);result={totals:report.totals,fields:report.fields};break;}
  default: console.log('基础词条工具（本地 Node.js，无 AI API、无游戏状态访问）\nassign-scope <all|npc|body|world|daily|text> <领取人>\nvalidate-delivery <整包.json>\nimport-delivery <整包.json>\nvalidate <交付.json>\nvalidate-v2 <语义素材v2.json>（只验收，不自动导入）\nassign <批次ID> <领取人>\nextend <词库代码> <领取人> <主题>\nimport <交付.json>\nreview <审稿.json>\nduplicates\nindex\ncontext <词库代码>\nexport <输出.json>\ninventory');
 }
 if(result)console.log(JSON.stringify(result,null,2));
} catch(e) {console.error(e.message);process.exitCode=1;}
