import { afterAll, describe, expect, it } from 'vitest';
import { testDb, testDbUrl } from '../../db/test-db';
import { daysFromNow, insertConsent } from '../consents/test-support';
import { registerForEvent } from './register';
import { SETTINGS, bornBefore, insertEvent, insertMember, registrationsOf } from './test-support';

/* docs/03 sections 7.2, 13 p. 2, 15, roadmap 5.10: only the minor's own `parental` consent, approved
 * and in force, admits; any other consent — refused, nothing written. */

const deps = { settings: SETTINGS };

describe.skipIf(!testDbUrl)('registrations: register — parental consent', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('rejected, expired, another kind or another member’s consent — refused', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx);
			const input = { eventId: event.id, categoryId: null };
			const minor = await insertMember(tx, { birthDate: bornBefore(15) });
			const sibling = await insertMember(tx, { birthDate: bornBefore(13) });
			await insertConsent(tx, minor.id, { status: 'rejected' });
			await insertConsent(tx, minor.id, { status: 'expired' });
			await insertConsent(tx, minor.id, { kind: 'medical', status: 'approved' });
			await insertConsent(tx, minor.id, { kind: 'privacy', status: 'approved' });
			await insertConsent(tx, sibling.id, { status: 'approved' });
			expect(await registerForEvent(tx, minor.id, input, deps)).toEqual({
				ok: false,
				reason: 'parental_consent'
			});
			expect(await registrationsOf(tx, event.id)).toHaveLength(0);
		});
	});

	it('approved with a term still running — admitted', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx);
			const minor = await insertMember(tx, { birthDate: bornBefore(16) });
			await insertConsent(tx, minor.id, { status: 'approved', validUntil: daysFromNow(30) });
			expect(
				await registerForEvent(tx, minor.id, { eventId: event.id, categoryId: null }, deps)
			).toMatchObject({ ok: true, status: 'registered' });
		});
	});

	it('18 or older — admitted without any consent', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx);
			const adult = await insertMember(tx, { birthDate: bornBefore(18) });
			expect(
				await registerForEvent(tx, adult.id, { eventId: event.id, categoryId: null }, deps)
			).toMatchObject({ ok: true, status: 'registered' });
		});
	});
});
