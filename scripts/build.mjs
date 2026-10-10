import { stripTypeScriptTypes } from 'node:module';
import { readdir, readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url)); const dist = path.join(root, 'dist');
await rm(dist, { recursive: true, force: true }); await mkdir(dist, { recursive: true });
async function compile(dir) {
  for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) { await compile(relative); continue; }
    const output = path.join(dist, relative.replace(/\.ts$/, '.js')); await mkdir(path.dirname(output), { recursive: true });
    if (entry.name.endsWith('.ts')) {
      const source = stripTypeScriptTypes(await readFile(path.join(root, relative), 'utf8'));
      // 原生 ESM 构建：只移除类型并转换静态模块扩展名，不把 JSON 内容塞进 HTML。
      await writeFile(output, source.replace(/(from\s+['"][^'"]+)\.ts(['"])/g, '$1.js$2'));
    } else await cp(path.join(root, relative), output);
  }
}
await compile('src'); await cp(path.join(root, 'content'), path.join(dist, 'content'), { recursive: true });
await writeFile(path.join(dist, 'index.html'), (await readFile(path.join(root, 'index.html'), 'utf8')).replace('./src/ui/main.ts', './src/ui/main.js'));
console.log('Built dist/: TypeScript modules → ESM JavaScript; JSON packs and CSS preserved.');
