import { existsSync } from 'node:fs';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import { consume, isLimited, type LimitDb } from './rate-limit';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const url = process.env.DATABASE_URL;

class Rollback extends Error {}

describe.skipIf(!url)('login attempt limits (rate_limit table)', () => {
	const client = postgres(url ?? '', { max: 1, onnotice: () => {} });
	const db = drizzle(client);
	afterAll(() => client.end());

	const rule = { windowMs: 60_000, max: 3 };
	const key = () => `test:${crypto.randomUUID()}`;

	async function inRollback(fn: (tx: LimitDb) => Promise<void>) {
		await db
			.transaction(async (tx) => {
				await fn(tx);
				throw new Rollback();
			})
			.catch((e) => {
				if (!(e instanceof Rollback)) throw e;
			});
	}

	it('allows max attempts in a window, then refuses', async () => {
		await inRollback(async (tx) => {
			const k = key();
			const t = 1_000_000;
			expect(await consume(tx, k, rule, t)).toBe(true);
			expect(await consume(tx, k, rule, t + 1)).toBe(true);
			expect(await consume(tx, k, rule, t + 2)).toBe(true);
			expect(await isLimited(tx, k, rule, t + 3)).toBe(true);
			expect(await consume(tx, k, rule, t + 3)).toBe(false);
		});
	});

	it('starts a fresh window once the old one has passed', async () => {
		await inRollback(async (tx) => {
			const k = key();
			const t = 1_000_000;
			for (let i = 0; i < 4; i++) await consume(tx, k, rule, t);
			expect(await isLimited(tx, k, rule, t + rule.windowMs)).toBe(false);
			expect(await consume(tx, k, rule, t + rule.windowMs)).toBe(true);
		});
	});

	it('keeps keys independent and does not count a read as an attempt', async () => {
		await inRollback(async (tx) => {
			const [a, b] = [key(), key()];
			for (let i = 0; i < 3; i++) await consume(tx, a, rule, 5);
			expect(await isLimited(tx, b, rule, 5)).toBe(false);
			for (let i = 0; i < 5; i++) await isLimited(tx, b, rule, 5);
			expect(await consume(tx, b, rule, 5)).toBe(true);
		});
	});
});
