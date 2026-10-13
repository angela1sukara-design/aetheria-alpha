import type { GameState, Id } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';

/** 历史 engine/core 指纹：变量扩表后 hash 会变，仍识别为可升级的官方核包。 */
export const LEGACY_CORE_HASHES = new Set([
  'aab3c415bcccdd459d21e7a0d0f4f3d636008b6e6809860452ec89787a7400f7',
  'da552b1fe226a6bdb0bd972a7d7e4535a779b210f96617532214c11322810f3a',
  '0a2330430d5c716ee803fb8e43712b798f60807bfdb8beabeb37baf01ced10d6',
  '7d6b5048a40893e027bd157cea182068c2a1db8d16a45da76641dc874e649ff9',
]);

/** 统一玩家变量：填补新 VariableDef、剔除已废弃键，并把 district:health 迁入 core:health。 */
export function normalizePlayerVariables(state: GameState, registry: Registry): void {
  const vars = state.player.variables as Record<string, number>;
  if (Object.prototype.hasOwnProperty.call(vars, 'district:health')) {
    const district = vars['district:health'];
    delete vars['district:health'];
    if (typeof district === 'number' && Number.isFinite(district)) {
      const hp = registry.variables.find(v => v.id === 'core:health');
      if (hp) {
        // 旧交锋条 0–40 → 统一生命 0–max（默认 100）
        const scaled = Math.round(district * (hp.max / 40));
        vars['core:health'] = Math.min(hp.max, Math.max(hp.min, scaled));
      }
    }
  }
  for (const def of registry.variables) {
    if (!(def.id in vars)) vars[def.id] = def.initial;
  }
  for (const id of Object.keys(vars)) {
    if (!registry.variables.some(v => v.id === id)) delete vars[id];
  }
}

/** 填补新 FlagDef、剔除废弃标记；旧积蓄模型理智一次性反转为余量。 */
export function normalizePlayerFlags(state: GameState, registry: Registry): void {
  const flags = state.player.flags as Record<string, boolean>;
  const vars = state.player.variables as Record<string, number>;
  const hadRemaining = Object.prototype.hasOwnProperty.call(flags, SANITY_REMAINING_FLAG);
  for (const def of registry.flags) {
    if (!(def.id in flags)) flags[def.id] = def.initial;
  }
  for (const id of Object.keys(flags)) {
    if (!registry.flags.some(f => f.id === id)) delete flags[id];
  }
  if (!hadRemaining && Object.prototype.hasOwnProperty.call(vars, SANITY_ID)) {
    const def = registry.variables.find(v => v.id === SANITY_ID);
    if (def) {
      const before = vars[SANITY_ID]!;
      vars[SANITY_ID] = Math.min(def.max, Math.max(def.min, def.max - before));
    }
    flags[SANITY_REMAINING_FLAG] = true;
  }
}

/** 包集合是否可作为「官方修复/扩表」升级目标：允许仅 engine/core hash 因变量扩表而变化。 */
export function isCoreExpandUpgradeTarget(registryPacks: { id: string; version: string; hash: string }[], expected: { id: string; version: string; hash: string }[]): boolean {
  if (registryPacks.length !== expected.length) return false;
  return expected.every(ref => {
    const installed = registryPacks.find(p => p.id === ref.id);
    if (!installed || installed.version !== ref.version) return false;
    if (installed.hash === ref.hash) return true;
    return ref.id === 'engine/core' && LEGACY_CORE_HASHES.has(ref.hash);
  });
}

/** 场景临时 arousal/restraint：旧存档缺字段时补 0。 */
export function normalizeSceneTemps(state: GameState): void {
  const scene = state.district?.scene;
  if (!scene) return;
  const s = scene as { arousal?: number; restraint?: number };
  if (!Number.isSafeInteger(s.arousal)) s.arousal = 0;
  if (!Number.isSafeInteger(s.restraint)) s.restraint = 0;
}

export const PLAYER_HP_ID = 'core:health' as Id;
export const SANITY_ID = 'core:sanity' as Id;
export const SANITY_BREAK_FLAG = 'core:flag.sanity_break' as Id;
/** 理智余量模型标记：缺省表示旧「积蓄上涨」存档，读档时一次性 max-value 反转。 */
export const SANITY_REMAINING_FLAG = 'core:flag.sanity_remaining' as Id;
/** @deprecated 已由 numerics.sanityGain 正式公式取代；保留以免旧测试/脚本引用断裂。值为压力扣减量。 */
export const SANITY_DEFEAT_DELTA = 6;
