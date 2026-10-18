import { describe, expect, it, vi } from 'vitest';
import { createCache } from './memory';

function setup(ttlSeconds = 60, maxEntries = 500) {
	let now = 1_000_000;
	const cache = createCache({ ttlSeconds: () => ttlSeconds, maxEntries, now: () => now });
	return { cache, tick: (ms: number) => (now += ms) };
}

const db = {} as never;

describe('memory cache (2.10)', () => {
	it('second call within the time limit does not query again', async () => {
		const { cache } = setup();
		const query = vi.fn(async (_db: never, slug: string) => `page ${slug}`);
		expect(await cache.query(['pages'], 'page', query, db, 'about')).toBe('page about');
		expect(await cache.query(['pages'], 'page', query, db, 'about')).toBe('page about');
		expect(query).toHaveBeenCalledOnce();
	});

	it('different arguments are different entries, and the query gets exactly them', async () => {
		const { cache } = setup();
		const query = vi.fn(async (_db: never, q: { page: number }) => q.page);
		expect(await cache.query(['posts'], 'news', query, db, { page: 1 })).toBe(1);
		expect(await cache.query(['posts'], 'news', query, db, { page: 2 })).toBe(2);
		expect(query).toHaveBeenCalledTimes(2);
	});

	it('expires after the time limit', async () => {
		const { cache, tick } = setup(60);
		const query = vi.fn(async () => 'x');
		await cache.query(['events'], 'list', query, db);
		tick(59_000);
		await cache.query(['events'], 'list', query, db);
		tick(2_000);
		await cache.query(['events'], 'list', query, db);
		expect(query).toHaveBeenCalledTimes(2);
	});

	it('invalidating a group drops only entries tagged with it', async () => {
		const { cache } = setup();
		const home = vi.fn(async () => 'home');
		const footer = vi.fn(async () => 'footer');
		await cache.query(['events', 'posts'], 'home', home, db);
		await cache.query(['settings'], 'footer', footer, db);
		cache.invalidate(['posts']);
		await cache.query(['events', 'posts'], 'home', home, db);
		await cache.query(['settings'], 'footer', footer, db);
		expect(home).toHaveBeenCalledTimes(2);
		expect(footer).toHaveBeenCalledOnce();
	});

	it('a load started before the invalidation does not put old data back', async () => {
		const { cache } = setup();
		let release: (v: string) => void = () => {};
		const slow = vi.fn(() => new Promise<string>((r) => (release = r)));
		const pending = cache.query(['posts'], 'news', slow, db);
		cache.invalidate(['posts']);
		release('old');
		expect(await pending).toBe('old');
		const fresh = vi.fn(async () => 'new');
		expect(await cache.query(['posts'], 'news', fresh, db)).toBe('new');
	});

	it('same request at the same time hits the database once', async () => {
		const { cache } = setup();
		const query = vi.fn(async () => 'x');
		await Promise.all([1, 2, 3].map(() => cache.query(['pages'], 'p', query, db)));
		expect(query).toHaveBeenCalledOnce();
	});

	it('an error is not cached', async () => {
		const { cache } = setup();
		const query = vi
			.fn<() => Promise<string>>()
			.mockRejectedValueOnce(new Error('db down'))
			.mockResolvedValueOnce('ok');
		await expect(cache.query(['pages'], 'p', query, db)).rejects.toThrow('db down');
		expect(await cache.query(['pages'], 'p', query, db)).toBe('ok');
	});

	it('keeps at most maxEntries, the oldest go first', async () => {
		const { cache } = setup(60, 2);
		const query = vi.fn(async (_db: never, n: number) => n);
		for (const n of [1, 2, 3]) await cache.query(['pages'], 'p', query, db, n);
		await cache.query(['pages'], 'p', query, db, 3);
		await cache.query(['pages'], 'p', query, db, 1);
		expect(query).toHaveBeenCalledTimes(4);
	});

	it('time limit 0 turns the cache off', async () => {
		const { cache } = setup(0);
		const query = vi.fn(async () => 'x');
		await cache.query(['pages'], 'p', query, db);
		await cache.query(['pages'], 'p', query, db);
		expect(query).toHaveBeenCalledTimes(2);
	});
});
