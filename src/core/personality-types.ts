import type { Id } from './types.ts';
export const TRAIT_KEYS = ['noble','shy','forthright','calculating','devout','playful'] as const;
export const TRAIT_TAGS: readonly Id[] = TRAIT_KEYS.map(key=>`personality:trait.${key}` as Id);
export interface TraitVariant { personality:string; traitTags:Id[] }
