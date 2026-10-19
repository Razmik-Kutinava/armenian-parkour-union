import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { payments } from '../../db/schema/payments';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { listActivePurposes } from './purposes';
import { recentDonations } from './public';
import { addPurpose } from './test-support';

/* docs/06 section 4.8, docs/04 section 5.4: name and amount unless anonymous; the donor email is
 * never shown; minors are not named publicly (docs/03 section 13). */

const future = (minutes: number) => new Date(Date.now() + 86_400_000 + minutes * 60_000);

async function paidDonation(tx: LimitDb, values: Partial<typeof payments.$inferInsert>) {
	const [row] = await tx
		.insert(payments)
		.values({
			kind: 'donation',
			status: 'paid',
			amountMinor: 5000,
			currency: 'AMD',
			provider: 'manual',
			paidAt: future(0),
			...values
		})
		.returning();
	return row;
}

describe.skipIf(!testDbUrl)('donations: public list', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('newest paid donations first: name and amount, never the email', async () => {
		await inRollback(async (tx) => {
			const adult = await insertUser(tx, { name: 'Aram Adult' });
			await paidDonation(tx, {
				donorName: 'Guest Anna',
				donorEmail: 'anna@example.com',
				amountMinor: 7000,
				paidAt: future(3)
			});
			await paidDonation(tx, { userId: adult.id, paidAt: future(2) });
			await paidDonation(tx, {
				donorName: 'Hidden',
				donorEmail: 'h@example.com',
				isAnonymous: true,
				paidAt: future(1)
			});
			const list = await recentDonations(tx, 3);
			expect(list).toEqual(
				[
					{ name: 'Guest Anna', amountMinor: 7000, currency: 'AMD', paidAt: future(3) },
					{ name: 'Aram Adult', amountMinor: 5000, currency: 'AMD', paidAt: future(2) },
					{ name: null, amountMinor: 5000, currency: 'AMD', paidAt: future(1) }
				].map((d) => ({ ...d, paidAt: expect.any(Date) }))
			);
			expect(JSON.stringify(list)).not.toMatch(/@example\.com/);
		});
	});

	it('minor or deleted member: no name', async () => {
		await inRollback(async (tx) => {
			const minorBirth = new Date(Date.now() - 12 * 365 * 86_400_000).toISOString().slice(0, 10);
			const minor = await insertUser(tx, { name: 'Young One', birthDate: minorBirth });
			const gone = await insertUser(tx, { name: 'Gone User', deletedAt: new Date() });
			await paidDonation(tx, { userId: minor.id, paidAt: future(2) });
			await paidDonation(tx, { userId: gone.id, paidAt: future(1) });
			expect((await recentDonations(tx, 2)).map((d) => d.name)).toEqual([null, null]);
		});
	});

	it('only paid donations: no fees, no pending, failed or refunded', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx);
			const marker = `Marker ${crypto.randomUUID()}`;
			await paidDonation(tx, { kind: 'membership', userId: user.id, paidAt: future(5) });
			for (const status of ['pending', 'failed', 'cancelled', 'refunded'] as const) {
				await paidDonation(tx, { status, donorName: marker, paidAt: future(4) });
			}
			await paidDonation(tx, { donorName: 'Shown', paidAt: future(3) });
			const [first] = await recentDonations(tx, 1);
			expect(first.name).toBe('Shown');
		});
	});

	it('purposes: only active ones, by order, title in the language with English fallback', async () => {
		await inRollback(async (tx) => {
			const second = await addPurpose(tx, { title: { en: 'Equipment' }, sortOrder: -900 });
			const first = await addPurpose(tx, { sortOrder: -1000 });
			const hidden = await addPurpose(tx, { isActive: false, sortOrder: -2000 });
			const list = await listActivePurposes(tx, 'ru');
			expect(list.slice(0, 2)).toEqual([
				{ id: first.id, title: 'Паркур-парк' },
				{ id: second.id, title: 'Equipment' }
			]);
			expect(list.map((p) => p.id)).not.toContain(hidden.id);
		});
	});
});
