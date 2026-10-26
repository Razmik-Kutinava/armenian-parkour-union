import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { translate } from '#lib/i18n/translate.ts';
import { consents } from '../../db/schema/consents';
import { events } from '../../db/schema/events';
import { memberships } from '../../db/schema/payments';
import { users } from '../../db/schema/users';
import { testDb, testDbUrl } from '../../db/test-db';
import { daysFromNow, insertConsent } from '../consents/test-support';
import { cancelRegistration } from './cancel';
import {
	HOUR,
	SETTINGS,
	SITE,
	bornBefore,
	cancelDeps as deps,
	insertCategory,
	insertEvent,
	insertMember,
	mailbox,
	registerOk as register,
	registrationOf
} from './test-support';
import { fillFromWaitlist } from './waitlist';

/* docs/03 section 7.3: the first in line takes a freed seat and gets a letter in their language. */

describe.skipIf(!testDbUrl)('registrations: the waitlist', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

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
			expect(await registrationOf(tx, second.id)).toMatchObject({
				status: 'registered',
				holdUntil: null
			});
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

	/** One seat taken, then `members` in line; frees the seat and returns the line's statuses. */
	async function freeSeatFor(
		tx: Parameters<typeof insertEvent>[0],
		members: { id: string }[],
		change: () => Promise<unknown>
	) {
		const event = await insertEvent(tx, { capacity: 1 });
		const holder = await insertMember(tx);
		await register(tx, holder.id, event.id);
		const queued = [];
		for (const m of members) queued.push(await register(tx, m.id, event.id));
		await change();
		const box = mailbox();
		expect(await cancelRegistration(tx, holder.id, event.id, deps(box))).toBe('ok');
		const statuses: string[] = [];
		for (const row of queued) statuses.push((await registrationOf(tx, row.id)).status);
		return { statuses, sent: box.sent.map((m) => m.to) };
	}

	it('the line skips a minor whose consent expired and a lapsed member; they keep their place', async () => {
		await inRollback(async (tx) => {
			const minor = await insertMember(tx, { birthDate: bornBefore(15) });
			const consent = await insertConsent(tx, minor.id, {
				status: 'approved',
				validUntil: daysFromNow(30)
			});
			const [lapsed, next] = [await insertMember(tx), await insertMember(tx)];
			const result = await freeSeatFor(tx, [minor, lapsed, next], async () => {
				await tx.update(consents).set({ status: 'expired' }).where(eq(consents.id, consent.id));
				await tx
					.update(memberships)
					.set({ endsAt: new Date(Date.now() - HOUR) })
					.where(eq(memberships.userId, lapsed.id));
			});
			expect(result).toEqual({
				statuses: ['waitlist', 'waitlist', 'registered'],
				sent: [next.email]
			});
		});
	});

	it('the line skips a blocked and a deleted member; they keep their place', async () => {
		await inRollback(async (tx) => {
			const [blocked, deleted, next] = [
				await insertMember(tx),
				await insertMember(tx),
				await insertMember(tx)
			];
			const result = await freeSeatFor(tx, [blocked, deleted, next], async () => {
				await tx.update(users).set({ status: 'blocked' }).where(eq(users.id, blocked.id));
				await tx.update(users).set({ deletedAt: new Date() }).where(eq(users.id, deleted.id));
			});
			expect(result).toEqual({
				statuses: ['waitlist', 'waitlist', 'registered'],
				sent: [next.email]
			});
		});
	});

	it('a raised limit lets as many in as fit (for the admin, 5.7)', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx, { capacity: 1 });
			const ids: string[] = [];
			for (let i = 0; i < 4; i++) {
				const member = await insertMember(tx);
				ids.push((await register(tx, member.id, event.id)).id);
			}
			await tx.update(events).set({ capacity: 3 }).where(eq(events.id, event.id));
			const letters = await fillFromWaitlist(tx, event.id, { settings: SETTINGS, siteUrl: SITE });
			expect(letters).toHaveLength(2);
			const statuses: string[] = [];
			for (const id of ids) statuses.push((await registrationOf(tx, id)).status);
			expect(statuses).toEqual(['registered', 'registered', 'registered', 'waitlist']);
		});
	});
});
