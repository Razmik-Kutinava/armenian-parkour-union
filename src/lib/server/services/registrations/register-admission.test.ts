import { afterAll, describe, expect, it } from 'vitest';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { insertConsent } from '../consents/test-support';
import { registerForEvent } from './register';
import {
	DAY,
	SETTINGS,
	bornBefore,
	insertCategory,
	insertEvent,
	insertMember,
	registrationsOf
} from './test-support';

/* docs/03 section 7.2 and 13 against the database: refusals write nothing. */

const deps = { settings: SETTINGS };

describe.skipIf(!testDbUrl)('registrations: register — admission', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('a hidden, unknown or deleted event — not found; a deleted member — not found', async () => {
		await inRollback(async (tx) => {
			const member = await insertMember(tx);
			const hidden = [
				await insertEvent(tx, { status: 'draft' }),
				await insertEvent(tx, { publishedAt: new Date(Date.now() + DAY) }),
				await insertEvent(tx, { deletedAt: new Date() }),
				await insertEvent(tx, { status: 'archived' })
			];
			for (const event of hidden) {
				expect(
					await registerForEvent(tx, member.id, { eventId: event.id, categoryId: null }, deps)
				).toEqual({ ok: false, reason: 'not_found' });
			}
			for (const eventId of [crypto.randomUUID(), 'nope']) {
				expect(await registerForEvent(tx, member.id, { eventId, categoryId: null }, deps)).toEqual({
					ok: false,
					reason: 'not_found'
				});
			}
			for (const status of ['cancelled', 'finished'] as const) {
				const shown = await insertEvent(tx, { status });
				expect(
					await registerForEvent(tx, member.id, { eventId: shown.id, categoryId: null }, deps)
				).toEqual({ ok: false, reason: 'closed' });
			}
			const event = await insertEvent(tx);
			const gone = await insertMember(tx, { deletedAt: new Date() });
			expect(
				await registerForEvent(tx, gone.id, { eventId: event.id, categoryId: null }, deps)
			).toEqual({ ok: false, reason: 'not_found' });
			expect(await registrationsOf(tx, event.id)).toHaveLength(0);
		});
	});

	it('no membership, unverified email — refused, nothing written', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx);
			const input = { eventId: event.id, categoryId: null };
			const stranger = await insertUser(tx, { emailVerified: true });
			expect(await registerForEvent(tx, stranger.id, input, deps)).toEqual({
				ok: false,
				reason: 'no_membership'
			});
			const unverified = await insertMember(tx, { emailVerified: false });
			expect(await registerForEvent(tx, unverified.id, input, deps)).toEqual({
				ok: false,
				reason: 'email_unverified'
			});
			expect(await registrationsOf(tx, event.id)).toHaveLength(0);
		});
	});

	it('a minor: refused without an approved parental consent, admitted with it', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx);
			const input = { eventId: event.id, categoryId: null };
			const minor = await insertMember(tx, { birthDate: bornBefore(14) });
			await insertConsent(tx, minor.id, { status: 'pending' });
			expect(await registerForEvent(tx, minor.id, input, deps)).toEqual({
				ok: false,
				reason: 'parental_consent'
			});
			await insertConsent(tx, minor.id, {
				status: 'approved',
				validUntil: new Date(Date.now() - DAY)
			});
			expect(await registerForEvent(tx, minor.id, input, deps)).toEqual({
				ok: false,
				reason: 'parental_consent'
			});
			await insertConsent(tx, minor.id, { status: 'approved' });
			expect(await registerForEvent(tx, minor.id, input, deps)).toMatchObject({
				ok: true,
				status: 'registered'
			});
		});
	});

	it('a category age range on the event day', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx);
			const kids = await insertCategory(tx, event.id, { ageMin: 8, ageMax: 12 });
			const adult = await insertMember(tx);
			expect(
				await registerForEvent(tx, adult.id, { eventId: event.id, categoryId: kids.id }, deps)
			).toEqual({ ok: false, reason: 'age_mismatch' });
		});
	});
});
