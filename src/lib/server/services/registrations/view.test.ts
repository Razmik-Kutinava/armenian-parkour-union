import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { eventRegistrations } from '../../db/schema/registrations';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { insertConsent } from '../consents/test-support';
import {
	DAY,
	HOUR,
	SETTINGS,
	bornBefore,
	insertCategory,
	insertEvent,
	insertMember,
	registerOk
} from './test-support';
import { registrationView } from './view';

/* docs/06 section 4.3: one server service decides what the registration block shows; the
 * conditions are docs/03 section 7 (the same `checkAdmission` the form action runs). */

const deps = { settings: SETTINGS, paymentsOn: true };

describe.skipIf(!testDbUrl)('registrations: the event page block', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('a guest is asked to log in; a finished or cancelled event shows no block', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx);
			expect(await registrationView(tx, null, event.id, deps)).toEqual({ state: 'guest' });
			const member = await insertMember(tx);
			for (const status of ['finished', 'cancelled'] as const) {
				const closed = await insertEvent(tx, { status });
				expect(await registrationView(tx, member.id, closed.id, deps)).toEqual({ state: 'none' });
				expect(await registrationView(tx, null, closed.id, deps)).toEqual({ state: 'none' });
			}
			expect(await registrationView(tx, member.id, crypto.randomUUID(), deps)).toEqual({
				state: 'none'
			});
		});
	});

	it('admission refusals in the order the member fixes them', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx);
			const refused = async (userId: string) => registrationView(tx, userId, event.id, deps);
			const unverified = await insertUser(tx, { emailVerified: false });
			expect(await refused(unverified.id)).toEqual({
				state: 'refused',
				reason: 'email_unverified',
				opensAt: null
			});
			const stranger = await insertUser(tx, { emailVerified: true });
			expect(await refused(stranger.id)).toMatchObject({ reason: 'no_membership' });
			const noBirthDate = await insertMember(tx, { birthDate: null });
			expect(await refused(noBirthDate.id)).toMatchObject({ reason: 'birth_date_required' });
			const minor = await insertMember(tx, { birthDate: bornBefore(14) });
			expect(await refused(minor.id)).toMatchObject({ reason: 'parental_consent' });
			await insertConsent(tx, minor.id, { status: 'approved' });
			expect(await refused(minor.id)).toMatchObject({ state: 'open' });
			const blocked = await insertMember(tx, { status: 'blocked' });
			expect(await refused(blocked.id)).toMatchObject({ reason: 'blocked' });
		});
	});

	it('the window: not open yet — with the date; closed — closed', async () => {
		await inRollback(async (tx) => {
			const member = await insertMember(tx);
			const opensAt = new Date(Date.now() + DAY);
			const later = await insertEvent(tx, { registrationOpensAt: opensAt });
			expect(await registrationView(tx, member.id, later.id, deps)).toEqual({
				state: 'refused',
				reason: 'not_open',
				opensAt
			});
			const over = await insertEvent(tx, { registrationClosesAt: new Date(Date.now() - HOUR) });
			expect(await registrationView(tx, member.id, over.id, deps)).toMatchObject({
				reason: 'closed'
			});
		});
	});

	it('categories: only the ones the age fits; none fits — age mismatch', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx);
			const kids = await insertCategory(tx, event.id, { ageMin: 8, ageMax: 12 });
			const open = await insertCategory(tx, event.id, { ageMin: 16 });
			const adult = await insertMember(tx);
			expect(await registrationView(tx, adult.id, event.id, deps)).toEqual({
				state: 'open',
				full: false,
				categories: [{ id: open.id, full: false }]
			});
			expect(kids.id).not.toBe(open.id);

			const onlyKids = await insertEvent(tx);
			await insertCategory(tx, onlyKids.id, { ageMin: 8, ageMax: 12 });
			expect(await registrationView(tx, adult.id, onlyKids.id, deps)).toEqual({
				state: 'refused',
				reason: 'age_mismatch',
				opensAt: null
			});
		});
	});

	it('no seats left: the waitlist is offered (event limit and category limit)', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx, { capacity: 1 });
			const [a, b] = [await insertMember(tx), await insertMember(tx)];
			expect(await registrationView(tx, b.id, event.id, deps)).toEqual({
				state: 'open',
				full: false,
				categories: []
			});
			await registerOk(tx, a.id, event.id);
			expect(await registrationView(tx, b.id, event.id, deps)).toMatchObject({ full: true });

			const split = await insertEvent(tx);
			const small = await insertCategory(tx, split.id, { capacity: 1, sortOrder: 0 });
			const big = await insertCategory(tx, split.id, { sortOrder: 1 });
			await registerOk(tx, a.id, split.id, small.id);
			expect(await registrationView(tx, b.id, split.id, deps)).toEqual({
				state: 'open',
				full: false,
				categories: [
					{ id: small.id, full: true },
					{ id: big.id, full: false }
				]
			});
		});
	});

	it('own registration: registered, waiting for payment with the hold, in line; cancel deadline', async () => {
		await inRollback(async (tx) => {
			const startsAt = new Date(Date.now() + 10 * DAY);
			const free = await insertEvent(tx, { capacity: 1, startsAt });
			const [a, b] = [await insertMember(tx), await insertMember(tx)];
			await registerOk(tx, a.id, free.id);
			await registerOk(tx, b.id, free.id);
			expect(await registrationView(tx, a.id, free.id, deps)).toEqual({
				state: 'mine',
				status: 'registered',
				holdUntil: null,
				expired: false,
				cancelUntil: startsAt
			});
			expect(await registrationView(tx, b.id, free.id, deps)).toMatchObject({
				state: 'mine',
				status: 'waitlist',
				cancelUntil: startsAt
			});
			const strict = { ...deps, settings: { ...SETTINGS, cancelHours: 24 } };
			expect(await registrationView(tx, a.id, free.id, strict)).toMatchObject({
				cancelUntil: new Date(startsAt.getTime() - 24 * HOUR)
			});

			const paid = await insertEvent(tx, { priceAmountMinor: 5000, startsAt });
			const { holdUntil } = await registerOk(tx, a.id, paid.id);
			expect(await registrationView(tx, a.id, paid.id, deps)).toEqual({
				state: 'mine',
				status: 'pending_payment',
				holdUntil,
				expired: false,
				cancelUntil: startsAt
			});
			await tx
				.update(eventRegistrations)
				.set({ holdUntil: new Date(Date.now() - 1000) })
				.where(eq(eventRegistrations.eventId, paid.id));
			expect(await registrationView(tx, a.id, paid.id, deps)).toMatchObject({ expired: true });

			await tx
				.update(eventRegistrations)
				.set({ holdUntil: new Date(startsAt.getTime() + 2 * DAY) })
				.where(eq(eventRegistrations.eventId, paid.id));
			const later = new Date(startsAt.getTime() + HOUR);
			expect(await registrationView(tx, a.id, paid.id, deps, later)).toMatchObject({
				status: 'pending_payment',
				expired: true
			});
		});
	});

	it('cancel is too late after the start; a cancelled registration may register again', async () => {
		await inRollback(async (tx) => {
			const soon = await insertEvent(tx, { startsAt: new Date(Date.now() + 2 * HOUR) });
			const member = await insertMember(tx);
			await registerOk(tx, member.id, soon.id);
			const strict = { ...deps, settings: { ...SETTINGS, cancelHours: 24 } };
			expect(await registrationView(tx, member.id, soon.id, strict)).toMatchObject({
				status: 'registered',
				cancelUntil: null
			});
			await tx
				.update(eventRegistrations)
				.set({ status: 'cancelled' })
				.where(eq(eventRegistrations.eventId, soon.id));
			expect(await registrationView(tx, member.id, soon.id, deps)).toMatchObject({
				state: 'open'
			});
		});
	});

	it('a paid event while online payment is off: registration is closed with a reason', async () => {
		await inRollback(async (tx) => {
			const paid = await insertEvent(tx, { priceAmountMinor: 5000 });
			const free = await insertEvent(tx);
			const member = await insertMember(tx);
			const off = { ...deps, paymentsOn: false };
			expect(await registrationView(tx, member.id, paid.id, off)).toEqual({
				state: 'refused',
				reason: 'payment_unavailable',
				opensAt: null
			});
			expect(await registrationView(tx, member.id, free.id, off)).toMatchObject({
				state: 'open'
			});
		});
	});
});
