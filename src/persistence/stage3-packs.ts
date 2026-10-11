import type { PackRef } from '../core/types.ts';
/** 第三阶段正式交付的4包指纹；恢复出口补丁只允许这个集合精确升级。 */
export const STAGE3_PACKS: PackRef[] = [
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
  },
  {
    "id": "aetheria/social",
    "version": "0.1.0",
    "hash": "06ef44297b2fd8361925cc66dc041fd6a7c3d8236f5fcf140f182c5bce36c9d6"
  }
];
/** 本次修复安装集合；旧四包内容不变，仅追加恢复出口包。 */
export const STAGE3_FIX1_PACKS: PackRef[] = [...STAGE3_PACKS, {
  id: 'aetheria/recovery', version: '0.1.0', hash: 'b7b3e778b810eed16cae4a9eea59d4a4c06c3f511123957905fe7735c36375e1',
}];
