import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { exams } from '../../db/schema/certification';
import { memberships } from '../../db/schema/payments';
import { courseAccess } from '../../db/schema/training-progress';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { bornYearsAgo, insertConsent } from '../consents/test-support';
import { daysFromNow } from '../memberships/test-support';
import { insertOpenCourse } from '../training/test-support';
import { getCabinetOverview } from './overview';

/* docs/06 section 5.1: greeting, membership, points and "what needs action" — own data only. */

async function period(
	tx: LimitDb,
	userId: string,
	status: 'active' | 'expired',
	from: number,
	to: number
) {
	await tx
		.insert(memberships)
		.values({ userId, status, startsAt: daysFromNow(from), endsAt: daysFromNow(to) });
}

describe.skipIf(!testDbUrl)('cabinet: overview', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('a new account: name, no level, zero points, confirm email and join', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx, { firstName: 'Ani', name: 'Ani Hakobyan' });
			const o = await getCabinetOverview(tx, user.id);
			expect(o).toMatchObject({
				firstName: 'Ani',
				name: 'Ani Hakobyan',
				avatarKey: null,
				level: null,
				pointsBalance: 0,
				emailVerified: false,
				reminder: null,
				actions: ['verify_email', 'join']
			});
			expect(o?.membership.active).toBe(false);
		});
	});

	it('a member whose membership ends soon: level, balance, "ends soon"', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx, {
				emailVerified: true,
				level: 'advanced',
				pointsBalance: 120
			});
			await period(tx, user.id, 'active', -350, 15);
			const o = await getCabinetOverview(tx, user.id);
			expect(o).toMatchObject({ level: 'advanced', pointsBalance: 120, emailVerified: true });
			expect(o?.membership.active).toBe(true);
			expect(o?.reminder?.kind).toBe('ends_soon');
			expect(o?.actions).toEqual(['membership_ends_soon']);
		});
	});

	it('an expired membership: "expired", not "join"', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx, { emailVerified: true, level: 'novice' });
			await period(tx, user.id, 'expired', -400, -35);
			const o = await getCabinetOverview(tx, user.id);
			expect(o?.reminder?.kind).toBe('expired');
			expect(o?.actions).toEqual(['membership_expired']);
		});
	});

	it('an active membership far from its end: nothing needs action', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx, { emailVerified: true, level: 'novice' });
			await period(tx, user.id, 'active', -10, 355);
			expect((await getCabinetOverview(tx, user.id))?.actions).toEqual([]);
		});
	});

	it('another member’s membership is not seen', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx, { emailVerified: true });
			const other = await insertUser(tx, { emailVerified: true });
			await period(tx, other.id, 'active', -10, 355);
			const o = await getCabinetOverview(tx, user.id);
			expect(o?.membership.active).toBe(false);
			expect(o?.actions).toEqual(['join']);
		});
	});

	it('a minor without a parental consent in force or under review: "consent needed"', async () => {
		await inRollback(async (tx) => {
			const child = await insertUser(tx, { emailVerified: true, birthDate: bornYearsAgo(12) });
			await period(tx, child.id, 'active', -10, 355);
			expect((await getCabinetOverview(tx, child.id))?.actions).toEqual(['consent_parental']);
			await insertConsent(tx, child.id, { status: 'rejected' });
			await insertConsent(tx, child.id, { status: 'approved', validUntil: daysFromNow(-1) });
			expect((await getCabinetOverview(tx, child.id))?.actions).toEqual(['consent_parental']);
			await insertConsent(tx, child.id, { status: 'pending' });
			expect((await getCabinetOverview(tx, child.id))?.actions).toEqual([]);

			const other = await insertUser(tx, { emailVerified: true, birthDate: bornYearsAgo(12) });
			await period(tx, other.id, 'active', -10, 355);
			await insertConsent(tx, other.id, { status: 'approved' });
			expect((await getCabinetOverview(tx, other.id))?.actions).toEqual([]);
		});
	});

	it('an approved course request: "open the portal" until the course is finished', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx, { emailVerified: true });
			await period(tx, user.id, 'active', -10, 355);
			const open = await insertOpenCourse(tx);
			const done = await insertOpenCourse(tx);
			const draft = await insertOpenCourse(tx, { status: 'draft' });
			const waiting = await insertOpenCourse(tx);
			const [exam] = await tx
				.insert(exams)
				.values({ userId: user.id, kind: 'trainer', result: 'passed', decidedAt: new Date() })
				.returning({ id: exams.id });
			const decided = { userId: user.id, reviewedAt: new Date() };
			await tx.insert(courseAccess).values([
				{ ...decided, courseId: open.id, status: 'approved' },
				{ ...decided, courseId: done.id, status: 'approved', examId: exam.id },
				{ ...decided, courseId: draft.id, status: 'approved' },
				{ userId: user.id, courseId: waiting.id, status: 'pending' }
			]);
			const o = await getCabinetOverview(tx, user.id);
			expect(o?.portals).toEqual([
				{ slug: open.slug, title: { ru: 'Курс тренера', en: 'Coach course' } }
			]);
			expect(o?.actions).toEqual([]);

			const other = await insertUser(tx, { emailVerified: true });
			expect((await getCabinetOverview(tx, other.id))?.portals).toEqual([]);
		});
	});

	it('a deleted, unknown or malformed id: null', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx, { deletedAt: new Date() });
			expect(await getCabinetOverview(tx, user.id)).toBeNull();
			expect(await getCabinetOverview(tx, crypto.randomUUID())).toBeNull();
			expect(await getCabinetOverview(tx, 'nope')).toBeNull();
		});
	});
});
