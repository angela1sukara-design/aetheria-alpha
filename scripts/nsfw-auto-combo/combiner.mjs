/**
 * NSFW 定词材质 × 部位/locus × 动作 自动组合器（U6 最小实现）
 * 公式：ComboKey = Material × Part|Locus × Action → [Defeat] → [TF通用|Mental]
 * 词条≠玩法≠数值；不改审定；不伪造 foundation:*；禁止物种 TF 专条。
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultAtomsPath = path.join(here, 'atoms.json');

/** @param {string} [atomsPath] */
export async function loadAtoms(atomsPath = defaultAtomsPath) {
  const raw = JSON.parse(await readFile(atomsPath, 'utf8'));
  if (raw.format !== 'aetheria-nsfw-auto-combo-atoms' || raw.schemaVersion !== 1) {
    throw new Error('atoms.json 格式无效。');
  }
  return raw;
}

function indexByKey(list) {
  return new Map(list.map((x) => [x.key, x]));
}

function resolveTarget(atoms, key) {
  const part = atoms.parts.find((p) => p.key === key);
  if (part) return { ...part, targetKind: 'part' };
  const locus = atoms.loci.find((l) => l.key === key);
  if (locus) return { ...locus, targetKind: 'locus' };
  throw new Error(`未知部位/locus：${key}`);
}

/**
 * @param {object} atoms
 * @param {{ material: string, targets?: string[], targetScene?: string, action: string, optionalState?: string|null, optionalTf?: string|null, optionalPose?: string|null, sampleId?: string, title?: string, defeatHook?: string, adultRequired?: boolean }} spec
 */
export function combine(atoms, spec) {
  const materials = indexByKey(atoms.materials);
  const actions = indexByKey(atoms.actions);
  const states = indexByKey(atoms.states);
  const tfs = indexByKey(atoms.tfs);
  const poses = indexByKey(atoms.poses);

  const material = materials.get(spec.material);
  const action = actions.get(spec.action);
  if (!material) throw new Error(`未知材质：${spec.material}`);
  if (!action) throw new Error(`未知动作：${spec.action}`);

  const targets = (spec.targets ?? []).map((k) => resolveTarget(atoms, k));
  const optionalPoseEarly = spec.optionalPose
    ? indexByKey(atoms.poses).get(spec.optionalPose) ?? null
    : null;
  const targetScene =
    spec.targetScene ??
    (optionalPoseEarly ? optionalPoseEarly.name : null);
  if (!targets.length && !targetScene) throw new Error('须提供 targets、targetScene 或姿态。');

  // 禁止物种 TF 专条：仅允许通用 Tf1 黏液化
  let optionalTf = null;
  if (spec.optionalTf) {
    optionalTf = tfs.get(spec.optionalTf);
    if (!optionalTf) throw new Error(`未知 TF：${spec.optionalTf}`);
    if (optionalTf.name !== '黏液化' && optionalTf.name !== '黑胶化') {
      throw new Error(`禁止物种 TF 专条：${optionalTf.name}`);
    }
  }

  const optionalState = spec.optionalState ? states.get(spec.optionalState) ?? null : null;
  const optionalPose = spec.optionalPose ? poses.get(spec.optionalPose) ?? null : null;
  const adultRequired = !!(spec.adultRequired || action.adultRequired);

  const targetLabel = targets.length
    ? targets.map((t) => t.name).join('、')
    : targetScene;

  const comboKey =
    [material.label, targetLabel, action.name].join('×') +
    (optionalState ? `→${optionalState.name}` : '') +
    (optionalTf ? `→${optionalTf.name}` : '');

  const slots = {
    材质: material.label,
    定词: material.dingci,
    '部位|locus': targetLabel,
    动作: action.name,
    mod色泽: null,
    进度: null,
    动作痕迹: `${action.name}痕迹`,
  };

  const fragment = fillStageA(slots, { adultRequired, optionalState, optionalPose });

  const gameplay = spec.gameplay
    ? (atoms.gameplayCategories ?? []).find((g) => g.key === spec.gameplay) ?? { key: spec.gameplay, name: spec.gameplay }
    : null;

  return {
    sampleId: spec.sampleId ?? null,
    title: spec.title ?? `${material.label}·${action.name}`,
    gameplay: gameplay ? { key: gameplay.key, id: gameplay.id ?? null, name: gameplay.name } : null,
    fantasyNpcKind: spec.fantasyNpcKind ?? null,
    comboKey,
    material,
    targets,
    targetScene,
    action,
    optionalState,
    optionalTf,
    optionalPose,
    adultRequired,
    defeatHook: spec.defeatHook ?? null,
    slots,
    fragment,
    lexiconRefs: [
      material.id,
      ...targets.map((t) => t.id),
      action.id,
      optionalState?.id,
      optionalTf?.id,
      optionalPose?.id,
    ].filter(Boolean),
    // 运行 tag 提案（U2）；不伪造 foundation:*
    proposedRuntimeTags: [
      optionalState ? `edit:tag.state.${optionalState.key.toLowerCase()}` : null,
      optionalTf ? `edit:tag.tf.slime` : null,
    ].filter(Boolean),
  };
}

function fillStageA(slots, { adultRequired, optionalState, optionalPose }) {
  const mat = slots['材质'];
  const part = slots['部位|locus'];
  const act = slots['动作'];
  let line = `${mat}在${part}发生${act}。接触可见，动作已经发生；战败外衣黏附、整身涂覆完成、黏液化与催眠态均尚未写入。`;
  if (optionalState) line += `描写目标态「${optionalState.name}」仅作素材指向，未写入 story.tags。`;
  if (optionalPose) line += `姿态参考「${optionalPose.name}」。`;
  if (adultRequired) line += '（本组合含成人向动作原子；完整成人正文须 adultOptional + 年龄≥18，关闭时仅用中性回退。）';
  return line;
}

/** 制作卡 §5 六样例 */
export function sampleCombos(atoms, opts = {}) {
  const allow = opts.gameplayKeys ?? atoms.playtestFilter?.gameplayKeys ?? null;
  const samples = allow
    ? atoms.samples.filter((s) => !s.gameplay || allow.includes(s.gameplay))
    : atoms.samples;
  return samples.map((s) =>
    combine(atoms, {
      material: s.material,
      targets: s.targets,
      targetScene: s.targetScene,
      action: s.action,
      optionalState: s.optionalState,
      optionalTf: s.optionalTf,
      optionalPose: s.optionalPose,
      sampleId: s.id,
      title: s.title,
      defeatHook: s.defeatHook,
      adultRequired: s.adultRequired,
      gameplay: s.gameplay,
      fantasyNpcKind: s.fantasyNpcKind,
    }),
  );
}

/** 按 8 玩法大类列出入口（供制作/可填槽）。 */
export function listGameplayCategories(atoms) {
  return atoms.gameplayCategories ?? [];
}

/**
 * 任意材质×部位×动作笛卡尔抽样（可跑；默认上限防爆炸）
 * @param {object} atoms
 * @param {{ limit?: number, materials?: string[], parts?: string[], actions?: string[] }} [opts]
 */
export function enumerateCombos(atoms, opts = {}) {
  const limit = opts.limit ?? 24;
  const mats = (opts.materials ?? atoms.materials.map((m) => m.key)).slice(0, 6);
  const parts = (opts.parts ?? [...atoms.parts.map((p) => p.key), ...atoms.loci.map((l) => l.key)]).slice(0, 6);
  const acts = (opts.actions ?? atoms.actions.map((a) => a.key)).slice(0, 6);
  const out = [];
  for (const m of mats) {
    for (const t of parts) {
      for (const a of acts) {
        out.push(combine(atoms, { material: m, targets: [t], action: a }));
        if (out.length >= limit) return out;
      }
    }
  }
  return out;
}

/**
 * 把组合结果变成 adventure 可挂载的候选遭遇节点描述（proposed-nodes / 构建输入）
 * @param {ReturnType<typeof combine>} combo
 * @param {{ nodeId: string, textKey: string, requireTagId: string, priority?: number, weight?: number }} ids
 */
export function toEncounterCandidate(combo, ids) {
  const detail = [
    `组合键：${combo.comboKey}`,
    combo.gameplay ? `玩法 ${combo.gameplay.key}（${combo.gameplay.name}）` : null,
    combo.fantasyNpcKind ? `fantasy NPC 种类占位：${combo.fantasyNpcKind}` : null,
    `材质 ${combo.material.id}（${combo.material.label}）`,
    `目标 ${combo.targets.map((t) => `${t.id}/${t.name}`).join('、') || combo.targetScene}`,
    `动作 ${combo.action.id}（${combo.action.name}）`,
    combo.optionalState ? `状态素材 ${combo.optionalState.id}` : null,
    combo.optionalTf ? `通用 TF ${combo.optionalTf.id}` : null,
    combo.defeatHook ? `战败挂接提示：${combo.defeatHook}` : null,
    '词条≠玩法≠数值；本节点不改 BodyGraph、不授予能力。',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    sampleId: combo.sampleId,
    comboKey: combo.comboKey,
    gameplay: combo.gameplay ?? null,
    fantasyNpcKind: combo.fantasyNpcKind ?? null,
    adultRequired: combo.adultRequired,
    lexiconRefs: combo.lexiconRefs,
    proposedRuntimeTags: combo.proposedRuntimeTags,
    node: {
      id: ids.nodeId,
      kind: 'encounter',
      stage: 'start',
      title: combo.title,
      textKey: ids.textKey,
      requiresTags: [{ role: 'opponent', tagId: ids.requireTagId }],
      excludesTags: [],
      conditions: [],
      tendencies: [],
      weight: ids.weight ?? 10,
      priority: ids.priority ?? 5,
      maxVisits: 1,
    },
    texts: {
      [ids.textKey]: combo.fragment,
      detail,
    },
    fragment: combo.fragment,
  };
}

/** 校验 hub 中真实存在且 ID 一致（不改审定） */
export async function verifyLexiconRefs(combo, hubDir) {
  const missing = [];
  for (const id of combo.lexiconRefs) {
    const m = /^lx\.(nsfw-[^.]+)\.(b\d+)\.(\d+)$/.exec(id);
    if (!m) {
      missing.push({ id, reason: '非 lx.nsfw-* batch ID' });
      continue;
    }
    const file = path.join(hubDir, `${m[1]}.${m[2]}.json`);
    try {
      const batch = JSON.parse(await readFile(file, 'utf8'));
      if (!batch.entries?.some((e) => e.id === id)) missing.push({ id, reason: `不在 ${path.basename(file)}` });
    } catch {
      missing.push({ id, reason: `缺少 ${path.basename(file)}` });
    }
  }
  return missing;
}

export { defaultAtomsPath };
