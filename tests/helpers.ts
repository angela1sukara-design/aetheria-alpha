import { readFile } from 'node:fs/promises';
import { loadPacks } from '../src/content/loader.ts';
import { ActionExecutor } from '../src/engine/executor.ts';
import { createGameState } from '../src/engine/state.ts';
import type { ContentPack, Id } from '../src/core/types.ts';
export async function packs(): Promise<ContentPack[]> {
  return Promise.all(['core', 'world', 'reshaping', 'social', 'recovery'].map(async name => JSON.parse(await readFile(new URL(`../content/${name}/pack.json`, import.meta.url), 'utf8'))));
}
export async function game(seed = 123456) { const registry = await loadPacks(await packs()); return { registry, engine: new ActionExecutor(registry, createGameState(registry, seed)) }; }
export function act(engine: ActionExecutor, suffix: string, requestId: string = crypto.randomUUID()) {
  return engine.performAction({ actionId: `aetheria:action.${suffix}` as Id }, engine.snapshot().meta.revision, requestId);
}
export function extension(): ContentPack {
  return {
    manifest: { id: 'test-author/ambient', namespace: 'test-author', version: '0.1.0', schemaVersion: 1, engineApiVersion: '0.1', author: 'Test fixture', status: 'draft', dependencies: [{ id: 'aetheria/world', version: '0.1.0', optional: false }], requiresCapabilities: ['condition.v1', 'effect.v1', 'hook.action.v1'], migrations: [] },
    variables: [], flags: [], hooks: [], locations: [], routes: [], events: [],
    actions: [{ id: 'test-author:action.watch', label: '观察街角', hint: '测试内容', group: 'explore', conditions: [], effects: [{ op: 'clock.advance', minutes: 7 }], resultText: 'test-author:text.watch' }],
    texts: { 'test-author:text.watch': '测试扩展包：观察完成。' },
    contributions: [{ hookId: 'aetheria:hook.street.actions', actionIds: ['test-author:action.watch'] }],
  };
}
