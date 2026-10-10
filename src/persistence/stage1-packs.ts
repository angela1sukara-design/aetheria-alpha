import type { PackRef } from '../core/types.ts';
// 只允许这个已交付第一阶段的精确包指纹升级；不猜测其他历史包。
export const STAGE1_PACKS: PackRef[] = [
  {
    "id": "engine/core",
    "version": "0.1.0",
    "hash": "aab3c415bcccdd459d21e7a0d0f4f3d636008b6e6809860452ec89787a7400f7"
  },
  {
    "id": "aetheria/world",
    "version": "0.1.0",
    "hash": "01ea5d235f7762c6e99ca9080c4390d02bdf9796208acab15a3437d615f2feb8"
  }
];
