import { afterAll, describe, expect, it } from 'vitest';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { fakeStorage } from '../media/fake-storage';
import { getOwnConsents } from './own';
import { bornYearsAgo, daysFromNow, insertConsent } from './test-support';
import { hasValidConsent } from './valid';

/* docs/06 section 5.10: status, term, reason of a refusal; own consents only (docs/04 section 5.3). */

describe.skipIf(!testDbUrl)('consents: cabinet documents', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('a minor sees the three kinds, an adult only the medical clearance', async () => {
		await inRollback(async (tx) => {
			const child = await insertUser(tx, { birthDate: bornYearsAgo(12) });
			const mine = await getOwnConsents(tx, fakeStorage(), child.id);
			expect(mine?.minor).toBe(true);
			expect(mine?.items.map((i) => i.kind)).toEqual(['parental', 'medical', 'privacy']);
			expect(mine?.items.every((i) => i.latest === null && i.inForce === null)).toBe(true);
			const adult = await insertUser(tx);
			const theirs = await getOwnConsents(tx, fakeStorage(), adult.id);
			expect(theirs?.minor).toBe(false);
			expect(theirs?.items.map((i) => i.kind)).toEqual(['medical']);
		});
	});

	it('the latest upload with its status and reason; the approved one stays in force', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx, { birthDate: bornYearsAgo(12) });
			const until = daysFromNow(100);
			await insertConsent(tx, user.id, { status: 'approved', validUntil: until });
			await insertConsent(tx, user.id, { status: 'pending' });
			await insertConsent(tx, user.id, {
				kind: 'privacy',
				status: 'rejected',
				reviewNote: 'Unreadable'
			});
			const items = (await getOwnConsents(tx, fakeStorage(), user.id))!.items;
			const parental = items.find((i) => i.kind === 'parental')!;
			expect(parental.latest?.status).toBe('pending');
			expect(parental.inForce).toEqual({ validUntil: until });
			const privacy = items.find((i) => i.kind === 'privacy')!;
			expect(privacy.latest).toMatchObject({ status: 'rejected', reviewNote: 'Unreadable' });
			expect(privacy.inForce).toBeNull();
		});
	});

	it('an approved consent past its date is shown as expired and is not in force', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx, { birthDate: bornYearsAgo(12) });
			await insertConsent(tx, user.id, { status: 'approved', validUntil: daysFromNow(-1) });
			const parental = (await getOwnConsents(tx, fakeStorage(), user.id))!.items[0];
			expect(parental.latest?.status).toBe('expired');
			expect(parental.inForce).toBeNull();
		});
	});

	it('the file opens by a short signed link; no bucket — no link; the key is never shown', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx, { birthDate: bornYearsAgo(12) });
			const row = await insertConsent(tx, user.id);
			const latest = (await getOwnConsents(tx, fakeStorage(), user.id))!.items[0].latest!;
			expect(latest.fileUrl).toContain(row.fileKey);
			expect(latest.fileUrl).toMatch(/get/);
			expect(latest).not.toHaveProperty('fileKey');
			const none = (await getOwnConsents(tx, null, user.id))!.items[0].latest!;
			expect(none.fileUrl).toBeNull();
		});
	});

	it('another member`s consents are not seen; a deleted or unknown id — null', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx, { birthDate: bornYearsAgo(12) });
			const other = await insertUser(tx, { birthDate: bornYearsAgo(12) });
			await insertConsent(tx, other.id, { status: 'approved' });
			const mine = await getOwnConsents(tx, fakeStorage(), user.id);
			expect(mine?.items.every((i) => i.latest === null)).toBe(true);
			const gone = await insertUser(tx, { deletedAt: new Date() });
			expect(await getOwnConsents(tx, fakeStorage(), gone.id)).toBeNull();
			expect(await getOwnConsents(tx, fakeStorage(), 'nope')).toBeNull();
		});
	});
});

describe.skipIf(!testDbUrl)('consents: valid consent (docs/03 section 13)', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('only approved and not past its date counts', async () => {
		await inRollback(async (tx) => {
			const cases = [
				[{ status: 'approved' as const }, true],
				[{ status: 'approved' as const, validUntil: daysFromNow(1) }, true],
				[{ status: 'approved' as const, validUntil: daysFromNow(-1) }, false],
				[{ status: 'pending' as const }, false],
				[{ status: 'rejected' as const }, false],
				[{ status: 'expired' as const }, false]
			] as const;
			for (const [values, expected] of cases) {
				const user = await insertUser(tx, { birthDate: bornYearsAgo(12) });
				await insertConsent(tx, user.id, values);
				expect(await hasValidConsent(tx, user.id, 'parental'), JSON.stringify(values)).toBe(
					expected
				);
				expect(await hasValidConsent(tx, user.id, 'privacy')).toBe(false);
			}
		});
	});
});
