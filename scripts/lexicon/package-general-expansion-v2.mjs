import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {deflateRawSync,inflateRawSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {projectRoot} from './refine-general-tags.mjs';
import {expansionV2Path} from './build-general-expansion-v2.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const archivePath = 'deliverables/tools/General-Vocabulary-Expansion-v2-2026-10-12.zip';
const manifestPath = 'deliverables/tools/General-Vocabulary-Expansion-v2-2026-10-12-package.json';
const crcTable = Array.from({length:256},(_,n) => {
  let value=n; for(let i=0;i<8;i++) value=(value&1) ? 0xedb88320^(value>>>1) : value>>>1;
  return value>>>0;
});
function crc32(bytes) {
  let crc=0xffffffff; for (const byte of bytes) crc=crcTable[(crc^byte)&255]^(crc>>>8);
  return (crc^0xffffffff)>>>0;
}
/** 仅打包已知、受控的项目相对路径；不处理 ZIP64 或外部下载。 */
function makeZip(files) {
  const local=[],central=[]; let offset=0;
  if (files.length>65535) throw Error('文件数超出普通ZIP限制。');
  for (const file of files) {
    const name=Buffer.from(file.path,'utf8'), packed=deflateRawSync(file.bytes,{level:9}), crc=crc32(file.bytes);
    if (file.bytes.length>0xffffffff || packed.length>0xffffffff || offset>0xffffffff) throw Error('需要ZIP64。');
    const header=Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50,0); header.writeUInt16LE(20,4); header.writeUInt16LE(0x800,6);
    header.writeUInt16LE(8,8); header.writeUInt16LE(33,12); header.writeUInt32LE(crc,14);
    header.writeUInt32LE(packed.length,18); header.writeUInt32LE(file.bytes.length,22); header.writeUInt16LE(name.length,26);
    const index=Buffer.alloc(46);
    index.writeUInt32LE(0x02014b50,0); index.writeUInt16LE(20,4); index.writeUInt16LE(20,6);
    index.writeUInt16LE(0x800,8); index.writeUInt16LE(8,10); index.writeUInt16LE(33,14);
    index.writeUInt32LE(crc,16); index.writeUInt32LE(packed.length,20); index.writeUInt32LE(file.bytes.length,24);
    index.writeUInt16LE(name.length,28); index.writeUInt32LE(offset,42);
    local.push(header,name,packed); central.push(index,name); offset+=header.length+name.length+packed.length;
  }
  const centralBytes=Buffer.concat(central), end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0); end.writeUInt16LE(files.length,8); end.writeUInt16LE(files.length,10);
  end.writeUInt32LE(centralBytes.length,12); end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,centralBytes,end]);
}
function verifyZip(bytes, files) {
  let cursor=0;
  for (const file of files) {
    if (bytes.readUInt32LE(cursor)!==0x04034b50) throw Error('ZIP头错误。');
    const size=bytes.readUInt32LE(cursor+18), nameLength=bytes.readUInt16LE(cursor+26);
    const name=bytes.subarray(cursor+30,cursor+30+nameLength).toString('utf8');
    const start=cursor+30+nameLength, raw=inflateRawSync(bytes.subarray(start,start+size));
    if(name!==file.path || raw.length!==file.bytes.length || sha(raw)!==sha(file.bytes) || crc32(raw)!==bytes.readUInt32LE(cursor+14))
      throw Error(`ZIP成员不一致：${name}`);
    cursor=start+size;
  }
  const end=bytes.length-22;
  if(bytes.readUInt32LE(end)!==0x06054b50 || bytes.readUInt32LE(end+16)!==cursor || bytes.readUInt16LE(end+10)!==files.length)
    throw Error('ZIP目录不一致。');
}
export async function packageExpansionV2(root=projectRoot) {
  const files=[];
  const add=async relative => {
    const absolute=path.resolve(root,relative), inside=path.relative(root,absolute);
    if(inside.startsWith('..') || path.isAbsolute(inside)) throw Error('打包路径越界。');
    files.push({path:relative,bytes:await readFile(absolute)});
  };
  async function walk(relative) {
    for(const item of (await readdir(path.join(root,relative),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))) {
      if(item.isSymbolicLink()) throw Error('补充资料不允许符号链接。');
      const next=`${relative}/${item.name}`; if(item.isDirectory()) await walk(next); else await add(next);
    }
  }
  await walk(expansionV2Path);
  for (const file of ['scripts/lexicon/common-general-seeds-v2.mjs','scripts/lexicon/build-general-expansion-v2.mjs',
    'scripts/lexicon/package-general-expansion-v2.mjs','tests/general-expansion-v2.test.ts',
    'docs/reference/general-vocabulary-expansion-v2.md','docs/reference/general-vocabulary-rule-plan.md']) await add(file);
  files.sort((a,b)=>a.path.localeCompare(b.path));
  const index=JSON.parse(await readFile(path.join(root,expansionV2Path,'index.json'),'utf8'));
  const manifest={format:'aetheria-vocabulary-supplement-package',schemaVersion:1,
    type:'supplement-requires-existing-project-not-full-game',sourceCheckpoint:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
    counts:index.counts,files:files.map(file=>({path:file.path,bytes:file.bytes.length,sha256:sha(file.bytes)}))};
  const included=[...files,{path:'package-manifest.json',bytes:Buffer.from(JSON.stringify(manifest,null,2)+'\n','utf8')}];
  const bytes=makeZip(included); verifyZip(bytes,included);
  await mkdir(path.join(root,'deliverables/tools'),{recursive:true});
  await writeFile(path.join(root,archivePath),bytes);
  verifyZip(await readFile(path.join(root,archivePath)),included);
  const receipt={...manifest,archive:{path:archivePath,bytes:bytes.length,sha256:sha(bytes),members:included.length,allMembersVerified:true}};
  await writeFile(path.join(root,manifestPath),JSON.stringify(receipt,null,2)+'\n','utf8');
  return receipt;
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  try { const receipt=await packageExpansionV2(); console.log(JSON.stringify({checkpoint:receipt.sourceCheckpoint,...receipt.archive},null,2)); }
  catch(error) { console.error(error.stack); process.exitCode=1; }
}
