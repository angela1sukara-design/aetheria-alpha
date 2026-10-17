import type { GameState, Id } from '../core/types.ts';
import { draw } from './rng.ts';

export type WildDefeatComboRow = {
  key: string;
  comboTagId: Id;
  material: string;
  part: string;
  action: string;
  lexiconRefs: readonly string[];
  tf?: string;
};

export type WildDefeatComboDraw = {
  comboKey: string;
  comboTagId: Id;
  material: string;
  part: string;
  action: string;
  lexiconRefs: readonly string[];
  tf?: string;
};

const tag = (s: string): Id => `progression:tag.${s}` as Id;

export const SALIVA_WOLF_COMBOS: readonly WildDefeatComboRow[] = [
  {
    key: 'saliva_neck',
    comboTagId: tag('beast.combo.saliva_neck'),
    material: '兽口涎',
    part: '脖颈',
    action: '兽吻舔颈',
    lexiconRefs: ['lx.nsfw-fluid.b0001.0018', 'lx.nsfw-part.b0001.0007', 'lx.nsfw-action.b0013.0009'],
  },
  {
    key: 'fur_waist',
    comboTagId: tag('beast.combo.fur_waist'),
    material: '潮湿绒毛',
    part: '腰侧',
    action: '爪按肩胛',
    lexiconRefs: ['lx.nsfw-material.b0001.0046', 'lx.nsfw-part.b0001.0016', 'lx.nsfw-action.b0013.0004'],
  },
  {
    key: 'saliva_thigh',
    comboTagId: tag('beast.combo.saliva_thigh'),
    material: '口涎',
    part: '大腿内侧',
    action: '涂抹',
    lexiconRefs: ['lx.nsfw-fluid.b0001.0018', 'lx.nsfw-part.b0001.0021', 'lx.nsfw-action.b0013.0002'],
  },
];

export const FOREST_SLUG_COMBOS: readonly WildDefeatComboRow[] = [
  {
    key: 'slug_ankle_coat',
    comboTagId: tag('beast.combo.forest_slug.ankle'),
    material: '蛞蝓黏液',
    part: '脚踝',
    action: '涂覆',
    lexiconRefs: ['lx.nsfw-material.b0002.0001', 'lx.nsfw-part.b0001.0023', 'lx.nsfw-action.b0002.0002'],
  },
  {
    key: 'slug_thigh_drip',
    comboTagId: tag('beast.combo.forest_slug.thigh'),
    material: '蛞蝓黏液',
    part: '大腿内侧',
    action: '滴落包覆',
    lexiconRefs: ['lx.nsfw-material.b0002.0001', 'lx.nsfw-part.b0001.0021', 'lx.nsfw-action.b0002.0003'],
  },
  {
    key: 'slug_waist_layer',
    comboTagId: tag('beast.combo.forest_slug.waist'),
    material: '蛞蝓黏液',
    part: '腰侧',
    action: '涂覆',
    lexiconRefs: ['lx.nsfw-material.b0002.0001', 'lx.nsfw-part.b0001.0016', 'lx.nsfw-action.b0002.0002'],
  },
];

export const TENTACLE_VINE_COMBOS: readonly WildDefeatComboRow[] = [
  {
    key: 'vine_wrist_bind',
    comboTagId: tag('monster.combo.tentacle_vine.wrist'),
    material: '活藤湿膜',
    part: '手腕',
    action: '缠绕',
    lexiconRefs: ['lx.nsfw-material.b0005.0004', 'lx.nsfw-part.b0001.0028', 'lx.nsfw-action.b0002.0001'],
  },
  {
    key: 'vine_neck_tight',
    comboTagId: tag('monster.combo.tentacle_vine.neck'),
    material: '缠绕茎',
    part: '脖颈',
    action: '勒紧固定',
    lexiconRefs: ['lx.nsfw-material.b0005.0004', 'lx.nsfw-part.b0001.0007', 'lx.nsfw-action.b0002.0005'],
  },
  {
    key: 'vine_hang_back',
    comboTagId: tag('monster.combo.tentacle_vine.hang'),
    material: '活藤',
    part: '身后',
    action: '倒挂',
    lexiconRefs: ['lx.nsfw-locus.b0001.0005', 'lx.nsfw-action.b0002.0006'],
  },
];

export const BOG_SLIME_COMBOS: readonly WildDefeatComboRow[] = [
  {
    key: 'slime_crotch_coat',
    comboTagId: tag('monster.combo.bog_slime.crotch'),
    material: '史莱姆黏液',
    part: '胯下',
    action: '涂覆',
    lexiconRefs: ['lx.nsfw-material.b0008.0002', 'lx.nsfw-locus.b0001.0001', 'lx.nsfw-action.b0002.0002'],
    tf: '黏液化',
  },
  {
    key: 'slime_waist_mold',
    comboTagId: tag('monster.combo.bog_slime.waist'),
    material: '史莱姆黏液',
    part: '腰侧',
    action: '涂覆',
    lexiconRefs: ['lx.nsfw-material.b0008.0002', 'lx.nsfw-part.b0001.0016', 'lx.nsfw-action.b0002.0002'],
    tf: '黏液化',
  },
  {
    key: 'slime_lip_seal',
    comboTagId: tag('monster.combo.bog_slime.lip'),
    material: '史莱姆黏液',
    part: '嘴唇',
    action: '封口包覆',
    lexiconRefs: ['lx.nsfw-material.b0008.0002', 'lx.nsfw-part.b0001.0001', 'lx.nsfw-action.b0002.0004'],
    tf: '黏液化',
  },
];

export const HIVE_CRAWLER_COMBOS: readonly WildDefeatComboRow[] = [
  {
    key: 'hive_back_clamp',
    comboTagId: tag('beast.combo.hive_crawler.back'),
    material: '虫巢黏液',
    part: '身后',
    action: '节肢钳制',
    lexiconRefs: ['lx.nsfw-material.b0005.0003', 'lx.nsfw-locus.b0001.0005', 'lx.nsfw-action.b0004.0001'],
  },
  {
    key: 'hive_wrist_cocoon',
    comboTagId: tag('beast.combo.hive_crawler.wrist'),
    material: '虫巢黏液',
    part: '手腕',
    action: '结茧涂覆',
    lexiconRefs: ['lx.nsfw-material.b0005.0003', 'lx.nsfw-part.b0001.0028', 'lx.nsfw-action.b0004.0003'],
  },
  {
    key: 'hive_crotch_egg',
    comboTagId: tag('beast.combo.hive_crawler.crotch'),
    material: '虫巢黏液',
    part: '胯下',
    action: '产卵',
    lexiconRefs: ['lx.nsfw-material.b0005.0003', 'lx.nsfw-locus.b0001.0001', 'lx.nsfw-action.b0004.0002'],
  },
];

export const GEL_WARDEN_COMBOS: readonly WildDefeatComboRow[] = [
  {
    key: 'gel_lip_seal',
    comboTagId: tag('boss.combo.gel_warden.lip'),
    material: '活体黑胶',
    part: '嘴唇',
    action: '封口包覆',
    lexiconRefs: ['lx.nsfw-material.b0001.0001', 'lx.nsfw-part.b0001.0001', 'lx.nsfw-action.b0002.0004'],
    tf: '黑胶化',
  },
  {
    key: 'gel_body_drip',
    comboTagId: tag('boss.combo.gel_warden.body'),
    material: '凝胶膜',
    part: '整身',
    action: '滴落包覆',
    lexiconRefs: ['lx.nsfw-material.b0001.0006', 'lx.nsfw-part.b0001.0030', 'lx.nsfw-action.b0002.0003'],
    tf: '黑胶化',
  },
  {
    key: 'gel_crotch_press',
    comboTagId: tag('boss.combo.gel_warden.crotch'),
    material: '活体黑胶',
    part: '胯下',
    action: '抵入',
    lexiconRefs: ['lx.nsfw-material.b0001.0001', 'lx.nsfw-locus.b0001.0001', 'lx.nsfw-action.b0003.0001'],
    tf: '黑胶化',
  },
];

/** 战败 profile（含 .corruption 档案用同一抽选表） */
export const WILD_DEFEAT_COMBOS_BY_BASE_PROFILE: Record<string, readonly WildDefeatComboRow[]> = {
  'progression:profile.beast.saliva_wolf': SALIVA_WOLF_COMBOS,
  'progression:profile.beast.forest_slug': FOREST_SLUG_COMBOS,
  'progression:profile.monster.tentacle_vine': TENTACLE_VINE_COMBOS,
  'progression:profile.monster.bog_slime': BOG_SLIME_COMBOS,
  'progression:profile.beast.hive_crawler': HIVE_CRAWLER_COMBOS,
  'progression:profile.boss.gel_warden': GEL_WARDEN_COMBOS,
};

export const WILD_DEFEAT_BASE_PROFILES = Object.keys(WILD_DEFEAT_COMBOS_BY_BASE_PROFILE) as Id[];

export function wildDefeatBaseProfileId(profileId: Id): Id | undefined {
  if (profileId.endsWith('.corruption')) {
    const base = profileId.replace(/\.corruption$/, '') as Id;
    return WILD_DEFEAT_COMBOS_BY_BASE_PROFILE[base] ? base : undefined;
  }
  return WILD_DEFEAT_COMBOS_BY_BASE_PROFILE[profileId] ? profileId : undefined;
}

function pick<T>(state: GameState, stream: string, list: readonly T[]): T {
  const i = Math.min(list.length - 1, Math.floor(draw(state, stream) * list.length));
  return list[i]!;
}

export function drawSalivaWolfCombo(state: GameState, streamBase: string): WildDefeatComboDraw {
  return drawWildDefeatCombo(state, 'progression:profile.beast.saliva_wolf' as Id, streamBase);
}

export function drawWildDefeatCombo(state: GameState, baseProfileId: Id, streamBase: string): WildDefeatComboDraw {
  const rows = WILD_DEFEAT_COMBOS_BY_BASE_PROFILE[baseProfileId];
  if (!rows) throw new Error(`wild-defeat combo table missing: ${baseProfileId}`);
  const row = pick(state, `${streamBase}:combo`, rows);
  return {
    comboKey: row.key,
    comboTagId: row.comboTagId,
    material: row.material,
    part: row.part,
    action: row.action,
    lexiconRefs: row.lexiconRefs,
    tf: row.tf,
  };
}
