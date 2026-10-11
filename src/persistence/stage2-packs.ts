import type { PackRef } from '../core/types.ts';
/** 发布的第二阶段原始内容包指纹；仅允许精确升级。 */
export const STAGE2_PACKS: PackRef[] = [
  {
    "id": "engine/core",
    "version": "0.1.0",
    "hash": "aab3c415bcccdd459d21e7a0d0f4f3d636008b6e6809860452ec89787a7400f7"
  },
  {
    "id": "aetheria/world",
    "version": "0.1.0",
    "hash": "01ea5d235f7762c6e99ca9080c4390d02bdf9796208acab15a3437d615f2feb8"
  },
  {
    "id": "aetheria/reshaping",
    "version": "0.1.0",
    "hash": "90a0fd948b069cdf62257b650f6fdfe2f2ef7f619a00efd1bef8d3baf4aab7a2"
  }
];
