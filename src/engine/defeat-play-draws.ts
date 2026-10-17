import type { GameState } from '../core/types.ts';
import type {
  DefeatMaterialKey,
  DefeatPlayKey,
  EnemyDefeatComboConfig,
  EnemySpeciesKind,
  GenericTfAtom,
} from '../core/district-types.ts';
import { draw } from './rng.ts';

/** 人/兽/怪等物种显示标签（非物种 TF 专条） */
export const DEFEAT_PLAY_OPPONENTS = [
  { kind: 'human', label: '人类对手' },
  { kind: 'beast', label: '野兽' },
  { kind: 'monster', label: '异形生物' },
  { kind: 'plant', label: '妖异藤植' },
  { kind: 'slime', label: '胶质生物' },
  { kind: 'insect', label: '虫巢异虫' },
  { kind: 'construct', label: '失控构装体' },
] as const;

/** 基础三类随机池（保持无配置入口与旧测试 RNG 完全一致） */
export const DEFAULT_OPPONENT_KINDS = ['human', 'beast', 'monster'] as const;

/**
 * 定词挂前材质表（与 scripts/nsfw-auto-combo/atoms.json materials 对齐）。
 * label = dingci ? dingci+base名 : base；转化只用通用黏液化/黑胶化。
 */
export const DEFEAT_PLAY_MATERIALS = [
  { key: 'M1' as DefeatMaterialKey, dingci: '蛞蝓', base: '黏液', label: '蛞蝓黏液' },
  { key: 'M2' as DefeatMaterialKey, dingci: '触手', base: '黏液', label: '触手黏液' },
  { key: 'M3' as DefeatMaterialKey, dingci: '虫巢', base: '黏液', label: '虫巢黏液' },
  { key: 'M4' as DefeatMaterialKey, dingci: '史莱姆', base: '黏液', label: '史莱姆黏液' },
  { key: 'M5' as DefeatMaterialKey, dingci: null, base: '活体黑胶', label: '活体黑胶' },
  { key: 'M6' as DefeatMaterialKey, dingci: null, base: '凝胶膜', label: '凝胶膜' },
  { key: 'M7' as DefeatMaterialKey, dingci: '兽径', base: '活藤', label: '兽径活藤' },
  { key: 'M8' as DefeatMaterialKey, dingci: '翠暗', base: '缠绕茎', label: '翠暗缠绕茎' },
  { key: 'M9' as DefeatMaterialKey, dingci: '柔韧', base: '藤条', label: '柔韧藤条' },
  { key: 'M10' as DefeatMaterialKey, dingci: '虫巢', base: '丝茧', label: '虫巢丝茧' },
] as const;

export const DEFEAT_PLAY_PARTS = ['手腕', '腰侧', '脚踝', '大腿内侧', '脖颈', '锁骨窝', '嘴唇', '小腿', '膝弯', '肩胛', '眼周', '耳廓'] as const;

/** 通用 goo TF 原子 only — 禁止物种专条 */
export const DEFEAT_PLAY_TFS: readonly GenericTfAtom[] = ['黏液化', '黑胶化'] as const;

/**
 * 与 nsfw-auto-combo candidates 对齐的轻量挂接行：
 * 抽一格 → opponentKind + material + 首选 part + 默认关联玩法大类。
 */
export const DEFEAT_PLAY_COMBO_ROWS = [
  { sampleId: 'C1', opponentKind: 'monster', materialKey: 'M2' as DefeatMaterialKey, part: '手腕', playKey: 'G1' as DefeatPlayKey },
  { sampleId: 'C2', opponentKind: 'beast', materialKey: 'M1' as DefeatMaterialKey, part: '脚踝', playKey: 'G2' as DefeatPlayKey },
  { sampleId: 'C3', opponentKind: 'monster', materialKey: 'M6' as DefeatMaterialKey, part: '腰侧', playKey: 'G2' as DefeatPlayKey },
  { sampleId: 'C4', opponentKind: 'monster', materialKey: 'M5' as DefeatMaterialKey, part: '嘴唇', playKey: 'G4' as DefeatPlayKey },
  { sampleId: 'C5', opponentKind: 'beast', materialKey: 'M3' as DefeatMaterialKey, part: '腰侧', playKey: 'G5' as DefeatPlayKey },
  { sampleId: 'C6', opponentKind: 'monster', materialKey: 'M4' as DefeatMaterialKey, part: '大腿内侧', playKey: 'G3' as DefeatPlayKey },
  { sampleId: 'C7', opponentKind: 'monster', materialKey: 'M2' as DefeatMaterialKey, part: '脖颈', playKey: 'G4' as DefeatPlayKey },
  { sampleId: 'C8', opponentKind: 'human', materialKey: 'M5' as DefeatMaterialKey, part: '大腿内侧', playKey: 'G7' as DefeatPlayKey },
  { sampleId: 'C9', opponentKind: 'beast', materialKey: 'M3' as DefeatMaterialKey, part: '腰侧', playKey: 'G8' as DefeatPlayKey },
  { sampleId: 'C10', opponentKind: 'human', materialKey: 'M4' as DefeatMaterialKey, part: '嘴唇', playKey: 'G6' as DefeatPlayKey },
  { sampleId: 'C11', opponentKind: 'monster', materialKey: 'M2' as DefeatMaterialKey, part: '腰侧', playKey: 'G1' as DefeatPlayKey },
  { sampleId: 'C12', opponentKind: 'monster', materialKey: 'M6' as DefeatMaterialKey, part: '大腿内侧', playKey: 'G3' as DefeatPlayKey },
  { sampleId: 'C13', opponentKind: 'plant', materialKey: 'M7' as DefeatMaterialKey, part: '手腕', playKey: 'G1' as DefeatPlayKey },
  { sampleId: 'C14', opponentKind: 'plant', materialKey: 'M8' as DefeatMaterialKey, part: '脚踝', playKey: 'G6' as DefeatPlayKey },
  { sampleId: 'C15', opponentKind: 'plant', materialKey: 'M9' as DefeatMaterialKey, part: '眼周', playKey: 'G4' as DefeatPlayKey },
  { sampleId: 'C16', opponentKind: 'insect', materialKey: 'M10' as DefeatMaterialKey, part: '腰侧', playKey: 'G1' as DefeatPlayKey },
  { sampleId: 'C17', opponentKind: 'insect', materialKey: 'M3' as DefeatMaterialKey, part: '小腿', playKey: 'G5' as DefeatPlayKey },
  { sampleId: 'C18', opponentKind: 'slime', materialKey: 'M1' as DefeatMaterialKey, part: '锁骨窝', playKey: 'G2' as DefeatPlayKey },
  { sampleId: 'C19', opponentKind: 'monster', materialKey: 'M5' as DefeatMaterialKey, part: '手腕', playKey: 'G7' as DefeatPlayKey },
  { sampleId: 'C20', opponentKind: 'slime', materialKey: 'M4' as DefeatMaterialKey, part: '膝弯', playKey: 'G8' as DefeatPlayKey },
] as const;

export function materialTraceForKey(key: DefeatMaterialKey): string {
  if (key === 'M7' || key === 'M8' || key === 'M9') {
    return '缠绕勒紧留下的深青藤痕与细碎草木湿膜';
  }
  if (key === 'M10') {
    return '层层缠裹留下的丝茧残缕与束缚压痕';
  }
  if (key === 'M5') {
    return '紧密收束后贴附在肌理间的哑光黑胶残膜';
  }
  return '尚未完全拭净的粘稠覆层残迹';
}

export type DefeatPlayFills = {
  opponentKind: string;
  materialKey: DefeatMaterialKey;
  material: string;
  materialBase: string;
  dingci: string;
  materialTrace: string;
  part: string;
  tf: GenericTfAtom | '';
  comboSample: string;
  playKey: DefeatPlayKey;
};

export interface DefeatPlayDrawOptions {
  speciesKind?: EnemySpeciesKind;
  defeatCombo?: EnemyDefeatComboConfig;
}

function pick<T>(state: GameState, stream: string, list: readonly T[]): T {
  const i = Math.min(list.length - 1, Math.floor(draw(state, stream) * list.length));
  return list[i]!;
}

/** 战败 8 玩法与敌人自动组合入口：按种子（及可选敌人专属池）抽对手 + 定词材质 + 部位 + 通用 TF。 */
export function drawDefeatPlayFills(
  state: GameState,
  streamBase: string,
  options?: DefeatPlayDrawOptions,
): DefeatPlayFills {
  const cfg = options?.defeatCombo;
  const allowedMatKeys = cfg?.materials?.length ? new Set(cfg.materials) : null;
  const filteredRows = allowedMatKeys
    ? DEFEAT_PLAY_COMBO_ROWS.filter(r => allowedMatKeys.has(r.materialKey))
    : DEFEAT_PLAY_COMBO_ROWS;
  const rowPool = filteredRows.length ? filteredRows : DEFEAT_PLAY_COMBO_ROWS;
  const row = pick(state, `${streamBase}:combo`, rowPool);

  const opponentKind = options?.speciesKind ?? row.opponentKind;
  const matPool = allowedMatKeys
    ? DEFEAT_PLAY_MATERIALS.filter(m => allowedMatKeys.has(m.key))
    : DEFEAT_PLAY_MATERIALS;
  const material = DEFEAT_PLAY_MATERIALS.find(m => m.key === row.materialKey && (!allowedMatKeys || allowedMatKeys.has(m.key)))
    ?? (matPool.length ? matPool[0]! : DEFEAT_PLAY_MATERIALS[0]);

  const partPool = cfg?.parts?.length ? cfg.parts : DEFEAT_PLAY_PARTS;
  const part = draw(state, `${streamBase}:part-flip`) < 0.35 || (cfg?.parts?.length && !cfg.parts.includes(row.part))
    ? pick(state, `${streamBase}:part`, partPool)
    : row.part;

  const hasExplicitEmptyTf = cfg?.tfs !== undefined && cfg.tfs.length === 0;
  const tfPool = cfg?.tfs?.length ? cfg.tfs : DEFEAT_PLAY_TFS;
  const tf: GenericTfAtom | '' = hasExplicitEmptyTf ? '' : pick(state, `${streamBase}:tf`, tfPool);

  const playKey = cfg?.plays?.length
    ? pick(state, `${streamBase}:play`, cfg.plays)
    : row.playKey;

  return {
    opponentKind,
    materialKey: material.key,
    material: material.label,
    materialBase: material.base,
    dingci: material.dingci ?? '',
    materialTrace: materialTraceForKey(material.key),
    part,
    tf,
    comboSample: row.sampleId,
    playKey,
  };
}

export function opponentLabelForKind(kind: string): string {
  return DEFEAT_PLAY_OPPONENTS.find(o => o.kind === kind)?.label ?? DEFEAT_PLAY_OPPONENTS[0].label;
}
