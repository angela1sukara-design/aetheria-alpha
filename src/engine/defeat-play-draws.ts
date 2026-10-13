import type { GameState } from '../core/types.ts';
import { draw } from './rng.ts';

/** 人/兽/怪占位标签（非物种 TF 专条） */
export const DEFEAT_PLAY_OPPONENTS = [
  { kind: 'human', label: '人类占位' },
  { kind: 'beast', label: '野兽占位' },
  { kind: 'monster', label: '怪物占位' },
] as const;

/**
 * 定词挂前材质表（与 scripts/nsfw-auto-combo/atoms.json materials 对齐）。
 * label = dingci ? dingci+base名 : base；转化只用通用黏液化/黑胶化。
 */
export const DEFEAT_PLAY_MATERIALS = [
  { key: 'M1', dingci: '蛞蝓', base: '黏液', label: '蛞蝓黏液' },
  { key: 'M2', dingci: '触手', base: '黏液', label: '触手黏液' },
  { key: 'M3', dingci: '虫巢', base: '黏液', label: '虫巢黏液' },
  { key: 'M4', dingci: '史莱姆', base: '黏液', label: '史莱姆黏液' },
  { key: 'M5', dingci: null, base: '活体黑胶', label: '活体黑胶' },
  { key: 'M6', dingci: null, base: '凝胶膜', label: '凝胶膜' },
] as const;

export const DEFEAT_PLAY_PARTS = ['手腕', '腰侧', '脚踝', '大腿内侧', '脖颈', '锁骨窝', '嘴唇'] as const;

/** 通用 goo TF 原子 only — 禁止物种专条 */
export const DEFEAT_PLAY_TFS = ['黏液化', '黑胶化'] as const;

/**
 * 与 nsfw-auto-combo 12 candidates 对齐的轻量挂接行：
 * 抽一格 → opponentKind + material + 首选 part。
 */
export const DEFEAT_PLAY_COMBO_ROWS = [
  { sampleId: 'C1', opponentKind: 'monster', materialKey: 'M2', part: '手腕' },
  { sampleId: 'C2', opponentKind: 'beast', materialKey: 'M1', part: '脚踝' },
  { sampleId: 'C3', opponentKind: 'monster', materialKey: 'M6', part: '腰侧' },
  { sampleId: 'C4', opponentKind: 'monster', materialKey: 'M5', part: '嘴唇' },
  { sampleId: 'C5', opponentKind: 'beast', materialKey: 'M3', part: '腰侧' },
  { sampleId: 'C6', opponentKind: 'monster', materialKey: 'M4', part: '大腿内侧' },
  { sampleId: 'C7', opponentKind: 'monster', materialKey: 'M2', part: '脖颈' },
  { sampleId: 'C8', opponentKind: 'human', materialKey: 'M5', part: '大腿内侧' },
  { sampleId: 'C9', opponentKind: 'beast', materialKey: 'M3', part: '腰侧' },
  { sampleId: 'C10', opponentKind: 'human', materialKey: 'M4', part: '嘴唇' },
  { sampleId: 'C11', opponentKind: 'monster', materialKey: 'M2', part: '腰侧' },
  { sampleId: 'C12', opponentKind: 'monster', materialKey: 'M6', part: '大腿内侧' },
] as const;

export type DefeatPlayFills = {
  opponentKind: string;
  material: string;
  materialBase: string;
  dingci: string;
  part: string;
  tf: string;
  comboSample: string;
};

function pick<T>(state: GameState, stream: string, list: readonly T[]): T {
  const i = Math.min(list.length - 1, Math.floor(draw(state, stream) * list.length));
  return list[i]!;
}

/** 战败 8 玩法入口：按种子抽对手占位 + 定词材质 + 部位 + 通用 TF。 */
export function drawDefeatPlayFills(state: GameState, streamBase: string): DefeatPlayFills {
  const row = pick(state, `${streamBase}:combo`, DEFEAT_PLAY_COMBO_ROWS);
  const opponent = DEFEAT_PLAY_OPPONENTS.find(o => o.kind === row.opponentKind) ?? DEFEAT_PLAY_OPPONENTS[0];
  const material = DEFEAT_PLAY_MATERIALS.find(m => m.key === row.materialKey) ?? DEFEAT_PLAY_MATERIALS[0];
  const part = draw(state, `${streamBase}:part-flip`) < 0.35
    ? pick(state, `${streamBase}:part`, DEFEAT_PLAY_PARTS)
    : row.part;
  const tf = pick(state, `${streamBase}:tf`, DEFEAT_PLAY_TFS);
  return {
    opponentKind: opponent.kind,
    material: material.label,
    materialBase: material.base,
    dingci: material.dingci ?? '',
    part,
    tf,
    comboSample: row.sampleId,
  };
}

export function opponentLabelForKind(kind: string): string {
  return DEFEAT_PLAY_OPPONENTS.find(o => o.kind === kind)?.label ?? '对手占位';
}
