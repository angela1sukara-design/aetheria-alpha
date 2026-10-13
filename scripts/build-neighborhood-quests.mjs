import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { stableJson } from '../src/core/types.ts';
import { parseQuestContent, selectQuestContent } from '../src/content/quest-schema.ts';
import { worlds } from '../production/quest-authoring/neighborhoods/worlds.mjs';
import { localSides, sharedCharacters, sharedAtmosphere } from '../production/quest-authoring/neighborhoods/sides.mjs';

const save = (file, value) => writeFile(file, JSON.stringify(value, null, 2) + '\n');
const choice = (id, label, result, minutes, memory = null, requires = []) => ({ id, label, result, requires, minutes, energy: 0, complete: true, memory });
export async function buildNeighborhoodQuests() {
  const entries = [];
  for (const world of worlds) {
    const source = {
      mainQuest: { id: `main.${world.key}_apex`, goal: `站上顶点：在${world.name}成为${world.titles[0]}，或成为${world.titles[1]}。`, paths: [], journal: [] },
      sideQuests: [],
      relationRules: { types: ['colleague', 'neighbor', 'acquaintance', 'grudge', 'debt'], perResident: '1-2', usage: '主线/支线只引用关系类型，生成器负责绑定具体居民 ID；共同经历只记录已选分支。' }
    };
    const execution = { stages: {}, sides: {} };
    const rows = localSides[world.key];
    const addSide = (key, row, type, relation, effect) => {
      const [title, locationType, prompt, a, ar, b, br] = row;
      const id = `side.${world.key}.${key}`, flag = `side:flag.${world.key}.${key}`;
      source.sideQuests.push({ id, type, locationType, requiresRelation: relation, objective: `${prompt} 当地选择：${a}，或${b}。`, flag, effectOnMain: effect, journalText: type === 'atmosphere' ? null : `在当地处理「${title}」：${a}，或${b}。无需返回报信。` });
      execution.sides[id] = { title, prompt, choices: [choice('a', a, ar, type === 'atmosphere' ? 1 : 10, relation ? ar : null), choice('b', b, br, type === 'atmosphere' ? 1 : 10, relation ? br : null)] };
      return flag;
    };
    const support = rows.slice(0, 6).map((row, i) => addSide(`support_${i + 1}`, row, 'main-related', null, `为${world.styles[i < 3 ? 0 : 1]}第${i % 3 + 1}阶段提供可选记录方案；不作为阶段入口或普通完成方式的前置。`));
    for (const [i, row] of sharedCharacters.entries()) addSide(`resident_${i + 1}`, row, 'character', ['neighbor', 'neighbor', 'colleague', 'acquaintance'][i], null);
    addSide('resident_5', rows[6], 'character', 'grudge', null);
    addSide('resident_6', rows[7], 'character', 'debt', null);
    [...rows.slice(8), ...sharedAtmosphere].forEach((row, i) => addSide(`moment_${i + 1}`, row, 'atmosphere', null, null));
    for (const [route, routeKey] of ['resource', 'stewardship'].entries()) {
      const stages = world.stages.slice(route * 4, route * 4 + 4).map((row, i) => {
        const [name, locationType, achievement, a, b] = row;
        const id = `${routeKey}_s${i + 1}`, flag = i === 3 ? 'main:flag.top_reached' : `main:flag.${routeKey}.${i + 1}`;
        const result = action => i === 3 ? `你${action}。${achievement}，以${world.titles[route]}的身份站上顶点。` : `你${action}。现场约定生效：${achievement}。`;
        const choices = [choice('a', a, result(a), 20), choice('b', b, result(b), 25)];
        if (i < 3) choices.push(choice('supported', `采用「${rows[route * 3 + i][0]}」的处理记录，完成${name}`, `你将已完成的当地处理记录纳入本次方案，现场确认责任与边界。${achievement}。`, 10, null, [support[route * 3 + i]]));
        execution.stages[id] = choices;
        return { id, name, locationType, objective: `${achievement}。需在当地完成试行、验收或双方签认；可以选择不同方案，也可暂缓后再来。`, flag, actions: choices.map(c => c.label), requires: [i === 0 ? 'main:flag.started' : `main:flag.${routeKey}.${i}`], next: i === 3 ? [] : [`${routeKey}_s${i + 2}`] };
      });
      source.mainQuest.paths.push({ id: `path.${routeKey}`, style: `${world.styles[route]}：成为${world.titles[route]}`, stages });
      stages.slice(0, -1).forEach((stage, i) => source.mainQuest.journal.push({ unlockFlag: stage.flag, text: `${stages[i + 1].name}：${stages[i + 1].objective}` }));
    }
    source.mainQuest.journal.unshift({ unlockFlag: 'main:flag.started', text: source.mainQuest.goal });
    source.mainQuest.journal.push({ unlockFlag: 'main:flag.top_reached', text: '你已取得本街区的最高席位。未完成的当地事务仍可继续。' });
    const content = parseQuestContent({ format: 'aetheria-quest-content', schemaVersion: 1, id: `aetheria/${world.key}-apex`, version: '1.0.0', sourceHash: createHash('sha256').update(stableJson(source)).digest('hex'), source, execution });
    const directory = `production/quest-authoring/neighborhoods/${world.key}`;
    await mkdir(directory, { recursive: true });
    await save(`${directory}/quest-tree.json`, source); await save(`${directory}/execution.json`, execution);
    entries.push({ environmentTag: `climate.${world.key}`, content });
  }
  const catalog = { format: 'aetheria-quest-catalog', schemaVersion: 1, entries };
  for (const entry of entries) selectQuestContent(catalog, [entry.environmentTag], tag => tag);
  await save('content/generation/neighborhood-quests.json', catalog);
  console.log('Neighborhood quests: 6 environment-specific trees, 48 stages, 108 side entries (60 local stories + 8 shared stories).');
}
