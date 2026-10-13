import { loadPacks } from './loader.ts';
import type { Registry } from './registry.ts';

/** Broken persisted add-ons must not prevent access to the base game or save recovery. */
export async function loadPersistedExtensions(base: unknown[], extensions: unknown[]): Promise<{ registry: Registry; accepted: unknown[]; quarantined: { raw: unknown; reason: string }[] }> {
  let registry = await loadPacks(base);
  const accepted: unknown[] = [], quarantined: { raw: unknown; reason: string }[] = [];
  let pending=[...extensions];
  while(pending.length){const failed:{raw:unknown;reason:string}[]=[];let progress=false;for(const raw of pending){try{registry=await loadPacks([...base,...accepted,raw]);accepted.push(raw);progress=true;}catch(error){failed.push({raw,reason:error instanceof Error?error.message:'扩展校验失败'});}}if(!progress){quarantined.push(...failed);break;}pending=failed.map(x=>x.raw);}
  return { registry, accepted, quarantined };
}
