import { afterAll, describe, expect, it } from 'vitest';
import type { ListState } from '#lib/components/admin/list-state.ts';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { fakeStorage } from '../media/fake-storage';
import { getConsentCard, listConsents } from './admin-list';
import { bornYearsAgo, daysFromNow, insertConsent } from './test-support';

/* docs/05 section 10: list with filters (kind, status, expiring in 30 days) and the card. */

const state = (q: string, filters: Record<string, string> = {}): ListState => ({
	page: 1,
	sort: 'createdAt',
	dir: 'desc',
	q,
	filters
});

describe.skipIf(!testDbUrl)('consents: admin list and card', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('filters by kind, status, and "expires within 30 days"; expired by date counts as expired', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx, { birthDate: bornYearsAgo(12) });
			const pending = await insertConsent(tx, user.id);
			const medical = await insertConsent(tx, user.id, { kind: 'medical', status: 'rejected' });
			const soon = await insertConsent(tx, user.id, {
				kind: 'privacy',
				status: 'approved',
				validUntil: daysFromNow(10)
			});
			const later = await insertConsent(tx, user.id, {
				status: 'approved',
				validUntil: daysFromNow(90)
			});
			const past = await insertConsent(tx, user.id, {
				status: 'approved',
				validUntil: daysFromNow(-2)
			});
			const ids = async (filters: Record<string, string>) =>
				(await listConsents(tx, state(user.tag, filters))).rows.map((r) => r.id).sort();

			expect((await listConsents(tx, state(user.tag))).total).toBe(5);
			expect(await ids({ kind: 'medical' })).toEqual([medical.id]);
			expect(await ids({ status: 'pending' })).toEqual([pending.id]);
			expect(await ids({ status: 'approved' })).toEqual([soon.id, later.id].sort());
			expect(await ids({ status: 'expired' })).toEqual([past.id]);
			expect(await ids({ expiring: '1' })).toEqual([soon.id]);
			expect(await ids({ kind: 'bogus', status: 'bogus' })).toHaveLength(5);
			const row = (await listConsents(tx, state(user.tag, { status: 'expired' }))).rows[0];
			expect(row).toMatchObject({ status: 'expired', kind: 'parental', userId: user.id });
		});
	});

	it('the search finds the member by name only', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx, { birthDate: bornYearsAgo(12) });
			await insertConsent(tx, user.id);
			expect((await listConsents(tx, state(user.tag))).rows[0].memberName).toContain(user.tag);
			expect((await listConsents(tx, state(`${user.tag}-nobody`))).total).toBe(0);
		});
	});

	it('the card: member and parent, age not birth date; email only with read_full', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx, {
				birthDate: bornYearsAgo(12),
				guardianName: 'Anna Petrosyan',
				guardianPhone: '+374 10 000000',
				guardianEmail: 'anna@example.com'
			});
			const consent = await insertConsent(tx, user.id, { guardianName: 'Anna Petrosyan' });
			const moderator = { id: crypto.randomUUID(), role: 'moderator' as const };
			const card = await getConsentCard(tx, moderator, fakeStorage(), consent.id);
			expect(card).toMatchObject({
				id: consent.id,
				kind: 'parental',
				status: 'pending',
				guardianName: 'Anna Petrosyan',
				member: {
					id: user.id,
					guardianName: 'Anna Petrosyan',
					guardianPhone: '+374 10 000000',
					guardianEmail: 'anna@example.com'
				}
			});
			expect(card?.member.age).toBeGreaterThanOrEqual(11);
			expect(card?.member).not.toHaveProperty('email');
			expect(card?.member).not.toHaveProperty('birthDate');
			expect(card?.fileUrl).toContain(consent.fileKey);
			expect(card).not.toHaveProperty('fileKey');

			const admin = { id: crypto.randomUUID(), role: 'admin' as const };
			const full = await getConsentCard(tx, admin, null, consent.id);
			expect(full?.member.email).toBe(user.email);
			expect(full?.fileUrl).toBeNull();
		});
	});

	it('no card for an editor, an unknown or malformed id', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx, { birthDate: bornYearsAgo(12) });
			const consent = await insertConsent(tx, user.id);
			const editor = { id: crypto.randomUUID(), role: 'editor' as const };
			const moderator = { id: crypto.randomUUID(), role: 'moderator' as const };
			expect(await getConsentCard(tx, editor, fakeStorage(), consent.id)).toBeNull();
			expect(await getConsentCard(tx, moderator, fakeStorage(), crypto.randomUUID())).toBeNull();
			expect(await getConsentCard(tx, moderator, fakeStorage(), 'nope')).toBeNull();
		});
	});
});
