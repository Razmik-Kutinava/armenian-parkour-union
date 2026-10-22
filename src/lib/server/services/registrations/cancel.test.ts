import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { translate } from '#lib/i18n/translate.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { events } from '../../db/schema/events';
import { eventRegistrations } from '../../db/schema/registrations';
import { testDb, testDbUrl } from '../../db/test-db';
import { cancelRegistration } from './cancel';
import { registerForEvent } from './register';
import {
	HOUR,
	SETTINGS,
	SITE,
	insertCategory,
	insertEvent,
	insertMember,
	mailbox,
	registrationOf
} from './test-support';
import { fillFromWaitlist } from './waitlist';

/* docs/03 section 7.3, 7.5: the member cancels before the start; the first in line takes the seat
 * and gets a letter after the commit (docs/03 section 14). */

async function register(tx: LimitDb, userId: string, eventId: string, categoryId: string | null = null) {
	const result = await registerForEvent(tx, userId, { eventId, categoryId }, { settings: SETTINGS });
	if (!result.ok) throw new Error(result.reason);
	return result;
}

const deps = (box = mailbox(), settings = SETTINGS) => ({ settings, send: box.send, siteUrl: SITE });

describe.skipIf(!testDbUrl)('registrations: cancel and the waitlist', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('the member cancels their own registration', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx, { priceAmountMinor: 5000 });
			const member = await insertMember(tx);
			const { id } = await register(tx, member.id, event.id);
			expect(await cancelRegistration(tx, member.id, event.id, deps())).toBe('ok');
			expect(await registrationOf(tx, id)).toMatchObject({ status: 'cancelled', holdUntil: null });
			expect(await cancelRegistration(tx, member.id, event.id, deps())).toBe('wrong_status');
		});
	});

	it('no own registration — not found; someone else’s stays untouched', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx);
			const [owner, other] = [await insertMember(tx), await insertMember(tx)];
			const { id } = await register(tx, owner.id, event.id);
			expect(await cancelRegistration(tx, other.id, event.id, deps())).toBe('not_found');
			expect(await cancelRegistration(tx, owner.id, crypto.randomUUID(), deps())).toBe('not_found');
			expect(await cancelRegistration(tx, owner.id, 'nope', deps())).toBe('not_found');
			expect((await registrationOf(tx, id)).status).toBe('registered');
		});
	});

	it('after the start — too late; cancel_hours before the start — too late, the waitlist may leave', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx, { capacity: 1, startsAt: new Date(Date.now() + 10 * HOUR) });
			const [a, b] = [await insertMember(tx), await insertMember(tx)];
			const first = await register(tx, a.id, event.id);
			const queued = await register(tx, b.id, event.id);
			const strict = { ...SETTINGS, cancelHours: 24 };
			expect(await cancelRegistration(tx, a.id, event.id, deps(mailbox(), strict))).toBe('too_late');
			expect(await cancelRegistration(tx, b.id, event.id, deps(mailbox(), strict))).toBe('ok');
			expect((await registrationOf(tx, first.id)).status).toBe('registered');
			expect((await registrationOf(tx, queued.id)).status).toBe('cancelled');

			await tx
				.update(events)
				.set({ startsAt: new Date(Date.now() - HOUR) })
				.where(eq(events.id, event.id));
			expect(await cancelRegistration(tx, a.id, event.id, deps())).toBe('too_late');
		});
	});

	it('a freed seat goes to the first in line, with a letter in their language', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx, { capacity: 1 });
			const a = await insertMember(tx);
			const b = await insertMember(tx, { locale: 'ru' });
			const c = await insertMember(tx);
			await register(tx, a.id, event.id);
			const second = await register(tx, b.id, event.id);
			const third = await register(tx, c.id, event.id);
			expect([second.status, third.status]).toEqual(['waitlist', 'waitlist']);
			const box = mailbox();
			expect(await cancelRegistration(tx, a.id, event.id, deps(box))).toBe('ok');
			expect(await registrationOf(tx, second.id)).toMatchObject({ status: 'registered', holdUntil: null });
			expect((await registrationOf(tx, third.id)).status).toBe('waitlist');
			expect(box.sent).toHaveLength(1);
			expect(box.sent[0].to).toBe(b.email);
			expect(box.sent[0].subject).toBe(
				translate('ru', 'registrations.mail.promoted.subject', { event: 'Весенний джем' })
			);
			expect(box.sent[0].text).toContain(`${SITE}/ru/events/${event.slug}`);
		});
	});

	it('a paid event: the first in line gets offer_hours to pay', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx, { capacity: 1, priceAmountMinor: 5000 });
			const [a, b] = [await insertMember(tx), await insertMember(tx)];
			await register(tx, a.id, event.id);
			const queued = await register(tx, b.id, event.id);
			const box = mailbox();
			const before = Date.now();
			expect(await cancelRegistration(tx, a.id, event.id, deps(box))).toBe('ok');
			const row = await registrationOf(tx, queued.id);
			expect(row.status).toBe('pending_payment');
			expect(row.holdUntil!.getTime()).toBeGreaterThanOrEqual(before + 48 * HOUR - 1000);
			expect(row.holdUntil!.getTime()).toBeLessThanOrEqual(Date.now() + 48 * HOUR + 1000);
			expect(box.sent).toHaveLength(1);
			const deadline = row.holdUntil!.toLocaleString('en', {
				dateStyle: 'long',
				timeStyle: 'short',
				timeZone: 'Asia/Yerevan'
			});
			expect(box.sent[0].text).toContain(deadline);
			expect(box.sent[0].text).toContain(`${SITE}/events/${event.slug}`);
		});
	});

	it('the line skips members whose category is still full', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx);
			const x = await insertCategory(tx, event.id, { capacity: 1 });
			const y = await insertCategory(tx, event.id, { capacity: 1 });
			const [a, d, b, c] = [
				await insertMember(tx),
				await insertMember(tx),
				await insertMember(tx),
				await insertMember(tx)
			];
			await register(tx, a.id, event.id, x.id);
			await register(tx, d.id, event.id, y.id);
			const inY = await register(tx, b.id, event.id, y.id);
			const inX = await register(tx, c.id, event.id, x.id);
			expect(await cancelRegistration(tx, a.id, event.id, deps())).toBe('ok');
			expect((await registrationOf(tx, inY.id)).status).toBe('waitlist');
			expect((await registrationOf(tx, inX.id)).status).toBe('registered');
		});
	});

	it('leaving the waitlist frees no seat: nobody moves, no letter', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx, { capacity: 1 });
			const [a, b, c] = [await insertMember(tx), await insertMember(tx), await insertMember(tx)];
			await register(tx, a.id, event.id);
			await register(tx, b.id, event.id);
			const last = await register(tx, c.id, event.id);
			const box = mailbox();
			expect(await cancelRegistration(tx, b.id, event.id, deps(box))).toBe('ok');
			expect((await registrationOf(tx, last.id)).status).toBe('waitlist');
			expect(box.sent).toHaveLength(0);
		});
	});

	it('a failed letter does not undo the cancel or the move', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx, { capacity: 1 });
			const [a, b] = [await insertMember(tx), await insertMember(tx)];
			const first = await register(tx, a.id, event.id);
			const queued = await register(tx, b.id, event.id);
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
			expect(await cancelRegistration(tx, a.id, event.id, deps(mailbox(true)))).toBe('ok');
			expect(warn).toHaveBeenCalled();
			warn.mockRestore();
			expect((await registrationOf(tx, first.id)).status).toBe('cancelled');
			expect((await registrationOf(tx, queued.id)).status).toBe('registered');
		});
	});

	it('a raised limit lets as many in as fit (for the admin, 5.7)', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx, { capacity: 1 });
			const people = [];
			for (let i = 0; i < 4; i++) people.push(await insertMember(tx));
			const rows = [];
			for (const p of people) rows.push(await register(tx, p.id, event.id));
			await tx.update(events).set({ capacity: 3 }).where(eq(events.id, event.id));
			const letters = await fillFromWaitlist(tx, event.id, { settings: SETTINGS, siteUrl: SITE });
			expect(letters).toHaveLength(2);
			const statuses = [];
			for (const r of rows) statuses.push((await registrationOf(tx, r.id)).status);
			expect(statuses).toEqual(['registered', 'registered', 'registered', 'waitlist']);
			const left = await tx
				.select()
				.from(eventRegistrations)
				.where(eq(eventRegistrations.status, 'waitlist'));
			expect(left.some((r) => r.id === rows[3].id)).toBe(true);
		});
	});
});
