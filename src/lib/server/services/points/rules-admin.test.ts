import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { UserRole } from '../../auth/session';
import { pointsRules } from '../../db/schema/points';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { auditFor } from '../memberships/test-support';
import { awardPoints } from './award';
import { getRule, listRules, updateRule } from './rules-admin';
import { ledgerOf, setRules, staffActor } from './test-support';

/* docs/05 section 13: list — code, title, points, active, who and when changed; an admin edits the
 * title ×3, points and "active", never the code; every change goes to audit_log. docs/03 section
 * 6.2 p. 4: a change applies to future awards only. docs/04: `points.rules` — admin only. */

const IP = { ip: '10.0.0.7' };
const values = (over: Partial<Parameters<typeof updateRule>[3]> = {}) => ({
	title: { en: 'Video approved', hy: 'Տեսանյութ', ru: 'Видео одобрено' },
	points: 30,
	isActive: true,
	...over
});

async function rowOf(tx: Parameters<typeof setRules>[0], id: string) {
	const [row] = await tx.select().from(pointsRules).where(eq(pointsRules.id, id));
	return row;
}

describe.skipIf(!testDbUrl)('points: rules in the admin', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('list: code, title, points, active, who and when changed; sorted by code', async () => {
		await inRollback(async (tx) => {
			const [rule] = await setRules(tx, { video_approved: { points: 10 } });
			const admin = await staffActor(tx);
			expect(await updateRule(tx, admin, rule.id, values(), IP)).toBe('ok');
			const rows = await listRules(tx);
			const codes = rows.map((r) => r.code);
			expect(codes).toEqual([...codes].sort());
			expect(rows.find((r) => r.id === rule.id)).toMatchObject({
				code: 'video_approved',
				title: values().title,
				points: 30,
				isActive: true,
				updatedByName: expect.stringContaining('Test'),
				updatedAt: expect.any(Date)
			});
			expect(await getRule(tx, rule.id)).toMatchObject({ code: 'video_approved', points: 30 });
		});
	});

	it('admin edits title, points and active: code stays, author and audit with only the changes', async () => {
		await inRollback(async (tx) => {
			const [rule] = await setRules(tx, { video_approved: { points: 10, isActive: true } });
			const admin = await staffActor(tx);
			const next = values({ title: { en: 'Approved video' }, points: 15, isActive: false });
			expect(await updateRule(tx, admin, rule.id, next, IP)).toBe('ok');
			const row = await rowOf(tx, rule.id);
			expect(row).toMatchObject({
				code: 'video_approved',
				title: { en: 'Approved video' },
				points: 15,
				isActive: false,
				updatedBy: admin.id
			});
			const audit = await auditFor(tx, 'points_rule', rule.id);
			expect(audit).toHaveLength(1);
			expect(audit[0]).toMatchObject({
				actorId: admin.id,
				action: 'points.rule_update',
				ip: IP.ip
			});
			expect(audit[0].before).toEqual({ title: rule.title, points: 10, isActive: true });
			expect(audit[0].after).toEqual({
				title: { en: 'Approved video' },
				points: 15,
				isActive: false
			});

			expect(await updateRule(tx, admin, rule.id, next, IP)).toBe('ok');
			expect(await auditFor(tx, 'points_rule', rule.id)).toHaveLength(1);
			expect(await updateRule(tx, admin, rule.id, { ...next, points: 16 }, IP)).toBe('ok');
			const [, second] = await auditFor(tx, 'points_rule', rule.id);
			expect(second.before).toEqual({ points: 15 });
			expect(second.after).toEqual({ points: 16 });
		});
	});

	it('a change applies to future awards only; 0 points awards nothing', async () => {
		await inRollback(async (tx) => {
			const [rule] = await setRules(tx, { video_approved: { points: 10 } });
			const admin = await staffActor(tx);
			const user = await insertUser(tx);
			const award = () =>
				awardPoints(tx, { rule: 'video_approved', userId: user.id, sourceId: crypto.randomUUID() });
			await award();
			expect(await updateRule(tx, admin, rule.id, values({ points: 25 }), IP)).toBe('ok');
			await award();
			expect(await updateRule(tx, admin, rule.id, values({ points: 0 }), IP)).toBe('ok');
			expect(await award()).toMatchObject({ status: 'skipped', reason: 'no_points' });
			expect((await ledgerOf(tx, user.id)).map((e) => e.delta)).toEqual([10, 25]);
		});
	});

	it('moderator, editor and member cannot edit; nothing is written', async () => {
		await inRollback(async (tx) => {
			const [rule] = await setRules(tx, { video_approved: { points: 10 } });
			for (const role of ['moderator', 'editor', 'member'] as UserRole[]) {
				const actor = await staffActor(tx, role);
				expect(await updateRule(tx, actor, rule.id, values(), IP), role).toBe('not_allowed');
			}
			expect((await rowOf(tx, rule.id)).points).toBe(10);
			expect(await auditFor(tx, 'points_rule', rule.id)).toHaveLength(0);
		});
	});

	it('unknown or malformed id — not found; bad values — invalid; nothing is written', async () => {
		await inRollback(async (tx) => {
			const [rule] = await setRules(tx, { video_approved: { points: 10 } });
			const admin = await staffActor(tx);
			for (const id of [crypto.randomUUID(), 'not-a-uuid']) {
				expect(await updateRule(tx, admin, id, values(), IP), id).toBe('not_found');
				expect(await getRule(tx, id), id).toBeNull();
			}
			for (const bad of [
				values({ points: -1 }),
				values({ points: 1.5 }),
				values({ points: 1_000_001 }),
				values({ points: Number.NaN }),
				values({ title: { en: '   ' } }),
				values({ title: { en: 'x'.repeat(201) } })
			]) {
				expect(await updateRule(tx, admin, rule.id, bad, IP), JSON.stringify(bad)).toBe('invalid');
			}
			expect((await rowOf(tx, rule.id)).points).toBe(10);
			expect(await auditFor(tx, 'points_rule', rule.id)).toHaveLength(0);
		});
	});
});
