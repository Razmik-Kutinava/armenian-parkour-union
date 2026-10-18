import { CACHE_TTL_SECONDS } from '$app/env/private';
import { createCache } from './memory';

export type { CacheGroup } from './memory';
export { groupsToInvalidate } from './admin-groups';

const DEFAULT_TTL_SECONDS = 60;

function ttlSeconds(): number {
	const value = Number(CACHE_TTL_SECONDS ?? DEFAULT_TTL_SECONDS);
	return Number.isFinite(value) && value >= 0 ? value : DEFAULT_TTL_SECONDS;
}

/* One per server process: on several Fly machines another machine lags behind for at most the time limit. */
export const publicCache = createCache({ ttlSeconds, maxEntries: 500 });

/** Public read through the cache; preview and admin call services directly. */
export const cached = publicCache.query;
