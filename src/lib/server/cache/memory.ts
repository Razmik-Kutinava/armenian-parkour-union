export type CacheGroup = 'settings' | 'pages' | 'posts' | 'events' | 'hero';

type Entry = { groups: readonly CacheGroup[]; expires: number; value: Promise<unknown> };

type Options = {
	/** Read on every call, so the setting can change without a restart. 0 — no caching. */
	ttlSeconds: () => number;
	maxEntries: number;
	now?: () => number;
};

/**
 * Public data in server memory (docs/06 section 8.2, decisions 2026-10-18): short time limit,
 * reset by group when the admin saves. The key is the query name plus its arguments, and the query
 * gets exactly those arguments, so a key never stands for other data.
 */
export function createCache({ ttlSeconds, maxEntries, now = Date.now }: Options) {
	const entries = new Map<string, Entry>();

	function query<A extends unknown[], R, D>(
		groups: readonly CacheGroup[],
		name: string,
		fn: (db: D, ...args: A) => Promise<R>,
		db: D,
		...args: A
	): Promise<R> {
		const ttl = ttlSeconds() * 1000;
		if (ttl <= 0) return fn(db, ...args);

		const key = `${name}:${JSON.stringify(args)}`;
		const hit = entries.get(key);
		if (hit && hit.expires > now()) return hit.value as Promise<R>;

		const value = fn(db, ...args);
		entries.delete(key);
		entries.set(key, { groups, expires: now() + ttl, value });
		if (entries.size > maxEntries) entries.delete(entries.keys().next().value!);
		value.catch(() => {
			if (entries.get(key)?.value === value) entries.delete(key);
		});
		return value;
	}

	/** Also drops loads still in flight, so a load that began before the save cannot stay. */
	function invalidate(groups: readonly CacheGroup[]): void {
		for (const [key, entry] of entries) {
			if (entry.groups.some((g) => groups.includes(g))) entries.delete(key);
		}
	}

	return { query, invalidate, clear: () => entries.clear() };
}
