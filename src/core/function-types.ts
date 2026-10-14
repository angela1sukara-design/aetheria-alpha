import type { Id } from './types.ts';

export const LOCATION_FACILITIES = ['seat', 'bed', 'care', 'workplace', 'training', 'publicDesk', 'lightSwitch'] as const;
export type LocationFacility = typeof LOCATION_FACILITIES[number];
export const LOCATION_SERVICES = ['rest', 'sleep', 'care', 'work', 'train', 'publicDesk', 'light', 'wait'] as const;
export const RESIDENT_SERVICES = ['talk', 'work', 'trade', 'teach', 'order', 'invest'] as const;
export type ServiceRequirement =
  | { subject: 'location'; service: typeof LOCATION_SERVICES[number] }
  | { subject: 'resident'; service: typeof RESIDENT_SERVICES[number]; id?: Id };
/** 只声明已具备执行器的服务。商品和训练必须引用真实定义；未声明即不提供。 */
export interface ResidentServices {
  work?: { label: string; text: string };
  trade?: Id[];
  teach?: Id[];
  orders?: boolean;
  investments?: boolean;
}
