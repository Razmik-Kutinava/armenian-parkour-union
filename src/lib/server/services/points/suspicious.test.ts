import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { readListState } from '#lib/components/admin/list-state.ts';
import type { UserRole } from '../../auth/session';
import type { LimitDb } from '../../auth/rate-limit';
import { auditLog, siteSettings } from '../../db/schema/service';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { adjustPoints } from './adjust';
import { pointsForExport } from './admin-export';
import { listPoints, pointsListOptions } from './admin-list';
import { appendEntry } from './ledger';
import { parseSuspicious, readSuspicious, saveSuspicious, SUSPICIOUS_DEFAULTS } from './suspicious';
import { staffActor } from './test-support';

/* docs/03 section 6.4, decisions.md 2026-10-21: the "suspicious" filter of the ledger — manual
 * operations, |amount| from 100, 5 or more entries of a member within 24 hours; thresholds live in
 * site_settings.points_suspicious and are edited on /admin/point-rules (admin only). */

const IP = { ip: '10.0.0.8' };
const KEY = 'points_suspicious';
const HOUR = 3_600_000;
const T0 = Date.parse('2026-03-01T08:00:00Z');

async function setKey(tx: LimitDb, value: unknown) {
	await tx
		.insert(siteSettings)
		.values({ key: KEY, value })
		.onConflictDoUpdate({ target: siteSettings.key, set: { value } });
}

async function system(tx: LimitDb, userId: string, delta: number, hoursFromT0 = 0) {
	const result = await appendEntry(tx, {
		userId,
		delta,
		reason: 'event_participation',
		sourceType: 'event_registration',
		sourceId: crypto.randomUUID(),
		createdAt: new Date(T0 + hoursFromT0 * HOUR)
	});
	if (result.status !== 'ok') throw new Error(result.status);
	return result.entry.id;
}

const suspiciousOf = async (tx: LimitDb, tag: string) =>
	(
		await listPoints(
			tx,
			readListState(new URLSearchParams({ q: tag, suspicious: '1' }), pointsListOptions)
		)
	).rows
		.map((r) => r.id)
		.sort();

describe('points: suspicious thresholds — parsing', () => {
	it('defaults are the owner decision of 2026-10-21', () => {
		expect(SUSPICIOUS_DEFAULTS).toEqual({
			manual: true,
			minAmount: 100,
			burstCount: 5,
			burstHours: 24
		});
	});

	it('stored snake_case value is read; missing or broken — defaults', () => {
		expect(
			parseSuspicious({ manual: false, min_amount: 300, burst_count: 3, burst_hours: 2 })
		).toEqual({ manual: false, minAmount: 300, burstCount: 3, burstHours: 2 });
		for (const broken of [
			undefined,
			null,
			'x',
			[],
			{},
			{ manual: 'yes', min_amount: 100, burst_count: 5, burst_hours: 24 },
			{ manual: true, min_amount: 0, burst_count: 5, burst_hours: 24 },
			{ manual: true, min_amount: 100, burst_count: 1, burst_hours: 24 },
			{ manual: true, min_amount: 100, burst_count: 5, burst_hours: 721 },
			{ manual: true, min_amount: 1.5, burst_count: 5, burst_hours: 24 }
		]) {
			expect(parseSuspicious(broken), JSON.stringify(broken)).toEqual(SUSPICIOUS_DEFAULTS);
		}
	});
});

describe.skipIf(!testDbUrl)('points: suspicious thresholds — storage and filter', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('read: missing key — defaults; admin saves — key and settings.update audit; others refused', async () => {
		await inRollback(async (tx) => {
			await tx.delete(siteSettings).where(eq(siteSettings.key, KEY));
			expect(await readSuspicious(tx)).toEqual(SUSPICIOUS_DEFAULTS);

			const next = { manual: false, minAmount: 250, burstCount: 3, burstHours: 12 };
			for (const role of ['moderator', 'editor', 'member'] as UserRole[]) {
				const actor = await staffActor(tx, role);
				expect(await saveSuspicious(tx, actor, next, IP.ip), role).toBe('not_allowed');
			}
			expect(await readSuspicious(tx)).toEqual(SUSPICIOUS_DEFAULTS);

			const admin = await staffActor(tx);
			expect(await saveSuspicious(tx, admin, next, IP.ip)).toBe('ok');
			expect(await readSuspicious(tx)).toEqual(next);
			const [row] = await tx.select().from(siteSettings).where(eq(siteSettings.key, KEY));
			expect(row.value).toEqual({
				manual: false,
				min_amount: 250,
				burst_count: 3,
				burst_hours: 12
			});
			const audit = await tx.select().from(auditLog).where(eq(auditLog.actorId, admin.id));
			expect(audit).toHaveLength(1);
			expect(audit[0]).toMatchObject({ action: 'settings.update', ip: IP.ip });
			expect(audit[0].after).toEqual({ [KEY]: row.value });
		});
	});

	it('filter: manual operations, |amount| from the threshold, any member burst — all entries of it', async () => {
		await inRollback(async (tx) => {
			await setKey(tx, { manual: true, min_amount: 100, burst_count: 5, burst_hours: 24 });
			const admin = await staffActor(tx);

			const a = await insertUser(tx);
			const big = await system(tx, a.id, 150);
			const exact = await system(tx, a.id, 100, 30);
			await system(tx, a.id, 5, 60);
			const manual = await adjustPoints(tx, admin, { userId: a.id, delta: -3, comment: 'x' }, IP);
			if (!manual.ok) throw new Error(manual.reason);
			expect(await suspiciousOf(tx, a.tag)).toEqual([big, exact, manual.entryId].sort());

			const burst = await insertUser(tx);
			const inBurst = [];
			for (const h of [0, 1, 2, 3, 23]) inBurst.push(await system(tx, burst.id, 5, h));
			await system(tx, burst.id, 5, 50);
			expect(await suspiciousOf(tx, burst.tag)).toEqual(inBurst.sort());

			const spread = await insertUser(tx);
			for (const h of [0, 7, 14, 21, 28]) await system(tx, spread.id, 5, h);
			expect(await suspiciousOf(tx, spread.tag)).toEqual([]);
		});
	});

	it('thresholds come from the key: manual off, higher amount, shorter burst', async () => {
		await inRollback(async (tx) => {
			await setKey(tx, { manual: false, min_amount: 200, burst_count: 3, burst_hours: 2 });
			const admin = await staffActor(tx);
			const a = await insertUser(tx);
			await system(tx, a.id, 150);
			const big = await system(tx, a.id, 200, 10);
			await adjustPoints(tx, admin, { userId: a.id, delta: 5, comment: 'x' }, IP);
			expect(await suspiciousOf(tx, a.tag)).toEqual([big]);

			const b = await insertUser(tx);
			const quick = [await system(tx, b.id, 5, 0), await system(tx, b.id, 5, 1)];
			quick.push(await system(tx, b.id, 5, 2));
			await system(tx, b.id, 5, 5);
			expect(await suspiciousOf(tx, b.tag)).toEqual(quick.sort());
		});
	});

	it('broken key — defaults; without the flag nothing is filtered; CSV uses the same filter', async () => {
		await inRollback(async (tx) => {
			await setKey(tx, 'broken');
			const a = await insertUser(tx);
			const big = await system(tx, a.id, 100);
			const small = await system(tx, a.id, 5, 30);
			expect(await suspiciousOf(tx, a.tag)).toEqual([big]);
			const state = (query: Record<string, string>) =>
				readListState(new URLSearchParams({ q: a.tag, ...query }), pointsListOptions);
			expect((await listPoints(tx, state({}))).total).toBe(2);
			expect((await listPoints(tx, state({ suspicious: 'yes' }))).total).toBe(2);
			expect((await listPoints(tx, state({ suspicious: '1' }))).total).toBe(1);
			const csv = await pointsForExport(tx, state({ suspicious: '1' }));
			expect(csv.map((r) => r.id)).toEqual([big]);
			expect(csv.map((r) => r.id)).not.toContain(small);
		});
	});
});
