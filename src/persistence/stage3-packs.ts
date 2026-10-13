import type { PackRef } from '../core/types.ts';
/** 历史第三阶段四包指纹（扩表前 engine/core）；用于识别旧存档。 */
export const STAGE3_PACKS_LEGACY: PackRef[] = [
  { "id": "engine/core", "version": "0.1.0", "hash": "aab3c415bcccdd459d21e7a0d0f4f3d636008b6e6809860452ec89787a7400f7" },
  { "id": "aetheria/world", "version": "0.1.0", "hash": "01ea5d235f7762c6e99ca9080c4390d02bdf9796208acab15a3437d615f2feb8" },
  { "id": "aetheria/reshaping", "version": "0.1.0", "hash": "90a0fd948b069cdf62257b650f6fdfe2f2ef7f619a00efd1bef8d3baf4aab7a2" },
  { "id": "aetheria/social", "version": "0.1.0", "hash": "06ef44297b2fd8361925cc66dc041fd6a7c3d8236f5fcf140f182c5bce36c9d6" }
];
/** 当前第三阶段四包指纹（含数值扩表后的 engine/core）。 */
export const STAGE3_PACKS: PackRef[] = [
  { "id": "engine/core", "version": "0.1.0", "hash": "8a581ae11e18f6e085a9ecaa12ce01485f366fc87aaaeea9faff1d03854e616f" },
  { "id": "aetheria/world", "version": "0.1.0", "hash": "01ea5d235f7762c6e99ca9080c4390d02bdf9796208acab15a3437d615f2feb8" },
  { "id": "aetheria/reshaping", "version": "0.1.0", "hash": "90a0fd948b069cdf62257b650f6fdfe2f2ef7f619a00efd1bef8d3baf4aab7a2" },
  { "id": "aetheria/social", "version": "0.1.0", "hash": "06ef44297b2fd8361925cc66dc041fd6a7c3d8236f5fcf140f182c5bce36c9d6" }
];
/** 历史修复包集合（扩表前）。 */
export const STAGE3_FIX1_PACKS_LEGACY: PackRef[] = [...STAGE3_PACKS_LEGACY, {
  id: 'aetheria/recovery', version: '0.1.0', hash: 'b7b3e778b810eed16cae4a9eea59d4a4c06c3f511123957905fe7735c36375e1',
}];
/** 本次修复安装集合；与 live game() 五包一致。 */
export const STAGE3_FIX1_PACKS: PackRef[] = [...STAGE3_PACKS, {
  id: 'aetheria/recovery', version: '0.1.0', hash: 'b7b3e778b810eed16cae4a9eea59d4a4c06c3f511123957905fe7735c36375e1',
}];
