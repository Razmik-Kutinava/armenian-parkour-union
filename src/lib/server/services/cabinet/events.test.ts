import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { pointsLedger } from '../../db/schema/points';
import { eventRegistrations } from '../../db/schema/registrations';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { DAY, HOUR, insertCategory, insertEvent, SETTINGS } from '../registrations/test-support';
import { listOwnEvents } from './events';

/* docs/06 section 5.4: own registrations — upcoming with "Pay" / "Cancel" by the conditions,
 * past with place, score and the points the ledger holds for the registration. */

type Status = typeof eventRegistrations.$inferInsert.status;

async function registration(
	tx: LimitDb,
	userId: string,
	eventId: string,
	status: Status,
	extra: Partial<typeof eventRegistrations.$inferInsert> = {}
) {
	const [row] = await tx
		.insert(eventRegistrations)
		.values({ eventId, userId, status, ...extra })
		.returning();
	return row;
}

const at = (days: number) => new Date(Date.now() + days * DAY);
const ago = (days: number) => ({
	startsAt: at(-days),
	endsAt: new Date(at(-days).getTime() + HOUR)
});

async function ledger(
	tx: LimitDb,
	userId: string,
	sourceId: string,
	delta: number,
	reason: 'event_registration' | 'event_participation' | 'event_place' | 'reversal' = 'event_place',
	reversalOfId: string | null = null
) {
	const [row] = await tx
		.insert(pointsLedger)
		.values({
			userId,
			delta,
			reason,
			sourceType: 'event_registration',
			sourceId,
			reversalOfId,
			comment: reason === 'reversal' ? 'cancelled' : null
		})
		.returning();
	return row;
}

describe.skipIf(!testDbUrl)('cabinet: my events', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('upcoming by start, past newest first; another member’s registrations are not seen', async () => {
		await inRollback(async (tx) => {
			const me = await insertUser(tx);
			const other = await insertUser(tx);
			const later = await insertEvent(tx, { startsAt: at(20) });
			const sooner = await insertEvent(tx, { startsAt: at(5) });
			const old = await insertEvent(tx, ago(30));
			const recent = await insertEvent(tx, ago(3));
			const foreign = await insertEvent(tx, { startsAt: at(7) });
			for (const e of [later, sooner, old, recent])
				await registration(tx, me.id, e.id, 'registered');
			await registration(tx, other.id, foreign.id, 'registered');

			const own = await listOwnEvents(tx, me.id, 'en', SETTINGS);
			expect(own.upcoming.map((r) => r.eventId)).toEqual([sooner.id, later.id]);
			expect(own.past.map((r) => r.eventId)).toEqual([recent.id, old.id]);
		});
	});

	it('an event under way is still upcoming until it ends', async () => {
		await inRollback(async (tx) => {
			const me = await insertUser(tx);
			const now = await insertEvent(tx, { startsAt: at(-0.1), endsAt: at(0.1) });
			await registration(tx, me.id, now.id, 'attended');
			const own = await listOwnEvents(tx, me.id, 'en', SETTINGS);
			expect(own.upcoming.map((r) => r.eventId)).toEqual([now.id]);
			expect(own.past).toEqual([]);
		});
	});

	it('title and category in the page language, English when missing', async () => {
		await inRollback(async (tx) => {
			const me = await insertUser(tx);
			const event = await insertEvent(tx);
			const category = await insertCategory(tx, event.id, {
				name: { en: 'Speed', ru: 'Скорость' }
			});
			await registration(tx, me.id, event.id, 'registered', { categoryId: category.id });
			const [ru] = (await listOwnEvents(tx, me.id, 'ru', SETTINGS)).upcoming;
			expect(ru).toMatchObject({ title: 'Весенний джем', categoryName: 'Скорость' });
			const [hy] = (await listOwnEvents(tx, me.id, 'hy', SETTINGS)).upcoming;
			expect(hy).toMatchObject({ title: 'Spring jam', categoryName: 'Speed', slug: event.slug });
		});
	});

	it('upcoming: "Pay" while the place is held, "Cancel" until the deadline', async () => {
		await inRollback(async (tx) => {
			const me = await insertUser(tx);
			const held = await insertEvent(tx, { priceAmountMinor: 5000 });
			const expired = await insertEvent(tx, { priceAmountMinor: 5000 });
			const line = await insertEvent(tx);
			const seat = await insertEvent(tx);
			await registration(tx, me.id, held.id, 'pending_payment', { holdUntil: at(0.01) });
			await registration(tx, me.id, expired.id, 'pending_payment', { holdUntil: at(-0.01) });
			await registration(tx, me.id, line.id, 'waitlist');
			await registration(tx, me.id, seat.id, 'registered');

			const rows = (await listOwnEvents(tx, me.id, 'en', SETTINGS)).upcoming;
			const of = (id: string) => rows.find((r) => r.eventId === id);
			expect(of(held.id)).toMatchObject({ status: 'pending_payment', canPay: true });
			expect(of(held.id)?.cancelUntil).toEqual(held.startsAt);
			expect(of(expired.id)).toMatchObject({ canPay: false });
			expect(of(line.id)).toMatchObject({ status: 'waitlist', canPay: false });
			expect(of(line.id)?.cancelUntil).toEqual(line.startsAt);
			expect(of(seat.id)?.cancelUntil).toEqual(seat.startsAt);

			const strict = { ...SETTINGS, cancelHours: 24 * 30 };
			const late = (await listOwnEvents(tx, me.id, 'en', strict)).upcoming;
			expect(late.find((r) => r.eventId === seat.id)?.cancelUntil).toBeNull();
			expect(late.find((r) => r.eventId === line.id)?.cancelUntil).toEqual(line.startsAt);
		});
	});

	it('no buttons on a cancelled registration, a cancelled event or after the start', async () => {
		await inRollback(async (tx) => {
			const me = await insertUser(tx);
			const mine = await insertEvent(tx);
			const called = await insertEvent(tx, { status: 'cancelled' });
			const started = await insertEvent(tx, { startsAt: at(-0.1), endsAt: at(0.1) });
			await registration(tx, me.id, mine.id, 'cancelled');
			await registration(tx, me.id, called.id, 'cancelled');
			await registration(tx, me.id, started.id, 'registered');

			const rows = (await listOwnEvents(tx, me.id, 'en', SETTINGS)).upcoming;
			for (const row of rows) expect(row).toMatchObject({ canPay: false, cancelUntil: null });
			expect(rows.find((r) => r.eventId === called.id)).toMatchObject({
				status: 'cancelled',
				eventCancelled: true
			});
			expect(rows.find((r) => r.eventId === mine.id)?.eventCancelled).toBe(false);
		});
	});

	it('past: only taking part — place, score and the points of this registration', async () => {
		await inRollback(async (tx) => {
			const me = await insertUser(tx);
			const won = await insertEvent(tx, ago(10));
			const missed = await insertEvent(tx, ago(9));
			const unmarked = await insertEvent(tx, ago(8));
			const left = await insertEvent(tx, ago(7));
			const waited = await insertEvent(tx, ago(6));
			const unpaid = await insertEvent(tx, ago(5));
			const a = await registration(tx, me.id, won.id, 'attended', { place: 1, score: '87.50' });
			await registration(tx, me.id, missed.id, 'no_show');
			await registration(tx, me.id, unmarked.id, 'registered');
			await registration(tx, me.id, left.id, 'cancelled');
			await registration(tx, me.id, waited.id, 'waitlist');
			await registration(tx, me.id, unpaid.id, 'pending_payment');

			const award = await ledger(tx, me.id, a.id, 5, 'event_registration');
			await ledger(tx, me.id, a.id, -5, 'reversal', award.id);
			await ledger(tx, me.id, a.id, 10, 'event_participation');
			await ledger(tx, me.id, a.id, 50, 'event_place');
			await ledger(tx, me.id, crypto.randomUUID(), 7);

			const past = (await listOwnEvents(tx, me.id, 'en', SETTINGS)).past;
			expect(past.map((r) => r.eventId)).toEqual([unmarked.id, missed.id, won.id]);
			expect(past[2]).toMatchObject({ status: 'attended', place: 1, score: '87.50', points: 60 });
			expect(past[1]).toMatchObject({ status: 'no_show', place: null, score: null, points: 0 });
			for (const row of past) expect(row).toMatchObject({ canPay: false, cancelUntil: null });
		});
	});

	it('a link only to an event the site shows; a deleted event is left out', async () => {
		await inRollback(async (tx) => {
			const me = await insertUser(tx);
			const shown = await insertEvent(tx, ago(4));
			const archived = await insertEvent(tx, { ...ago(3), status: 'archived' });
			const gone = await insertEvent(tx, { ...ago(2), deletedAt: new Date() });
			for (const e of [shown, archived, gone]) await registration(tx, me.id, e.id, 'attended');
			const past = (await listOwnEvents(tx, me.id, 'en', SETTINGS)).past;
			expect(past.map((r) => [r.eventId, r.linked])).toEqual([
				[archived.id, false],
				[shown.id, true]
			]);
		});
	});

	it('a deleted, unknown or malformed user: nothing', async () => {
		await inRollback(async (tx) => {
			const gone = await insertUser(tx, { deletedAt: new Date() });
			const event = await insertEvent(tx);
			await registration(tx, gone.id, event.id, 'registered');
			const empty = { upcoming: [], past: [] };
			expect(await listOwnEvents(tx, gone.id, 'en', SETTINGS)).toEqual(empty);
			expect(await listOwnEvents(tx, crypto.randomUUID(), 'en', SETTINGS)).toEqual(empty);
			expect(await listOwnEvents(tx, 'nope', 'en', SETTINGS)).toEqual(empty);
		});
	});
});
