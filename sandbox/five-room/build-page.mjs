import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
function strip(source) {
  return source
    .replace(/^import[\s\S]*?from '\.\/content\.mjs';\n/m, '')
    .replace(/^import[\s\S]*?from '\.\/game\.mjs';\n/m, '')
    .replace(/^export \{[^}]+\};\n?/m, '')
    .replace(/^export /gm, '');
}
const content = strip(await readFile(path.join(dir, 'content.mjs'), 'utf8'));
const game = strip(await readFile(path.join(dir, 'game.mjs'), 'utf8'));
const main = strip(await readFile(path.join(dir, 'main.mjs'), 'utf8'));
const css = await readFile(path.join(dir, 'style.css'), 'utf8');
const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>五间房</title>
  <style>
${css}
  </style>
</head>
<body>
  <main>
    <header>
      <p class="mark">五间房测试</p>
      <h1 id="place">开局</h1>
    </header>
    <section id="setup">
      <p>一局里有落脚点、工坊、暗渠、泵站和首领房。玩家、两名 NPC、两间高危区的怪物都会按种子掷出来。</p>
      <label>种子 <input id="seed" inputmode="numeric" placeholder="留空则随机"></label>
      <label class="check"><input id="adult" type="checkbox"> 开启成人内容，战败可以选择留下</label>
      <button id="begin" type="button">开始这一局</button>
    </section>
    <article id="scene" hidden>
      <p id="text"></p>
      <div id="choices"></div>
    </article>
  </main>
  <aside id="sheet" hidden>
    <h2>这一局</h2>
    <dl id="facts"></dl>
  </aside>
  <script>
${content}
${game}
${main}
  </script>
</body>
</html>
`;
await writeFile(path.join(dir, 'index.html'), html);
console.log('wrote sandbox/five-room/index.html');
