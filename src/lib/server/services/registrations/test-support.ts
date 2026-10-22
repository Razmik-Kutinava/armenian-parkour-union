import { asc, eq } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { eventCategories, events } from '../../db/schema/events';
import { memberships } from '../../db/schema/payments';
import { eventRegistrations } from '../../db/schema/registrations';
import { insertUser } from '../../db/test-db';
import type { Mail } from '../../mail/resend';
import type { RegistrationSettings } from './settings';

/* Test support only: registration tests run inside a rolled-back transaction; settings are passed in. */

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
export const SITE = 'https://parkour.test';
export const SETTINGS: RegistrationSettings = { holdMinutes: 30, offerHours: 48, cancelHours: 0 };

export async function insertEvent(tx: LimitDb, extra: Partial<typeof events.$inferInsert> = {}) {
	const startsAt = extra.startsAt ?? new Date(Date.now() + 10 * DAY);
	const [row] = await tx
		.insert(events)
		.values({
			slug: `t-reg-${crypto.randomUUID().slice(0, 8)}`,
			title: { en: 'Spring jam', ru: 'Весенний джем' },
			status: 'published',
			publishedAt: new Date(Date.now() - DAY),
			startsAt,
			endsAt: new Date(startsAt.getTime() + 2 * HOUR),
			...extra
		})
		.returning();
	return row;
}

export async function insertCategory(
	tx: LimitDb,
	eventId: string,
	extra: Partial<typeof eventCategories.$inferInsert> = {}
) {
	const [row] = await tx
		.insert(eventCategories)
		.values({ eventId, name: { en: 'Speed' }, ...extra })
		.returning();
	return row;
}

/** Verified email and a membership active now: admitted unless a test changes it. */
export async function insertMember(tx: LimitDb, values: Parameters<typeof insertUser>[1] = {}) {
	const user = await insertUser(tx, { emailVerified: true, ...values });
	await tx.insert(memberships).values({
		userId: user.id,
		status: 'active',
		startsAt: new Date(Date.now() - 30 * DAY),
		endsAt: new Date(Date.now() + 300 * DAY)
	});
	return user;
}

/** `YYYY-MM-DD` of the day `years` years and `days` days before `from` (UTC). */
export function bornBefore(years: number, from = new Date(), days = 0) {
	const d = new Date(from);
	d.setUTCFullYear(d.getUTCFullYear() - years);
	d.setUTCDate(d.getUTCDate() - days);
	return d.toISOString().slice(0, 10);
}

export async function registrationsOf(tx: LimitDb, eventId: string) {
	return tx
		.select()
		.from(eventRegistrations)
		.where(eq(eventRegistrations.eventId, eventId))
		.orderBy(asc(eventRegistrations.registeredAt));
}

export async function registrationOf(tx: LimitDb, id: string) {
	const [row] = await tx.select().from(eventRegistrations).where(eq(eventRegistrations.id, id));
	return row;
}

/** Letters the code tried to send; `failing` throws like an unreachable mail service. */
export function mailbox(failing = false) {
	const sent: Mail[] = [];
	const send = async (mail: Mail) => {
		if (failing) throw new Error('mail is down');
		sent.push(mail);
	};
	return { sent, send };
}
