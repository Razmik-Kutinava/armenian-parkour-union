import { and, eq, gt, isNull, lte, notExists } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { LimitDb } from '../../auth/rate-limit';
import { memberships } from '../../db/schema/payments';
import { users } from '../../db/schema/users';
import { reminderLetter, type MembershipMailDeps } from './mail';

const DAY_MS = 86_400_000;
const later = alias(memberships, 'later_membership');

/** docs/03 section 2 p. 4; the 7-day window goes first, so a short one gets one letter, not two. */
const REMINDERS = [
	{ days: 7, column: memberships.reminded7At, field: 'reminded7At', after: 0 },
	{ days: 30, column: memberships.reminded30At, field: 'reminded30At', after: 7 }
] as const;

type Reminder = (typeof REMINDERS)[number];

/** Only the latest active membership of an active user: a renewed one is not reminded. */
function dueReminders(db: LimitDb, reminder: Reminder, now: Date) {
	const from = new Date(now.getTime() + reminder.after * DAY_MS);
	const to = new Date(now.getTime() + reminder.days * DAY_MS);
	const renewed = db
		.select({ id: later.id })
		.from(later)
		.where(
			and(
				eq(later.userId, memberships.userId),
				eq(later.status, 'active'),
				gt(later.endsAt, memberships.endsAt)
			)
		);
	return db
		.select({
			id: memberships.id,
			endsAt: memberships.endsAt,
			email: users.email,
			locale: users.locale,
			firstName: users.firstName,
			name: users.name
		})
		.from(memberships)
		.innerJoin(users, eq(users.id, memberships.userId))
		.where(
			and(
				eq(memberships.status, 'active'),
				gt(memberships.endsAt, from),
				lte(memberships.endsAt, to),
				isNull(reminder.column),
				eq(users.status, 'active'),
				isNull(users.deletedAt),
				notExists(renewed)
			)
		);
}

/** The mark is set before sending: a rerun never writes twice (a failed send is only logged). */
export async function sendReminders(
	db: LimitDb,
	now: Date,
	deps: MembershipMailDeps
): Promise<number> {
	let sent = 0;
	for (const reminder of REMINDERS) {
		for (const row of await dueReminders(db, reminder, now)) {
			const [claimed] = await db
				.update(memberships)
				.set({ [reminder.field]: now })
				.where(and(eq(memberships.id, row.id), isNull(reminder.column)))
				.returning({ id: memberships.id });
			if (!claimed) continue;
			sent += 1;
			try {
				await deps.send(reminderLetter(row, row.endsAt!, deps.siteUrl));
			} catch (error) {
				console.error(`membership ${row.id}: reminder not sent`, error);
			}
		}
	}
	return sent;
}
