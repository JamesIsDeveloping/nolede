export type { Source } from './types';
export { nzSources } from './nz';
export { internationalSources } from './international';

import { nzSources } from './nz';
import { internationalSources } from './international';

// NZ sources first so they win deduplication ties for NZ stories
export const sources = [...nzSources, ...internationalSources];
