import { sql } from 'drizzle-orm';
import { volunteerCards } from '../../db/schema/volunteer-cards';

/* Facts of docs/03 section 19.2 for a row joined with `users`, the same as `card-facts.ts` reads one
 * by one: the admin list filters by validity in SQL. */

const at = (now: Date) => sql`${now.toISOString()}::timestamptz`;

/** The end of the membership that covers now, the latest of the active ones (memberships/overview). */
export const paidUntilSql = (now: Date) =>
	sql<Date | null>`(select max(m.ends_at) from memberships m
		where m.user_id = users.id and m.status = 'active' and m.ends_at > ${at(now)}
			and exists (select 1 from memberships c where c.user_id = users.id and c.status = 'active'
				and c.starts_at <= ${at(now)} and c.ends_at > ${at(now)}))`.mapWith(volunteerCards.updatedAt);

/** The `privacy` consent in force (consents/valid.ts `inForce`). */
export const privacySql = (now: Date) =>
	sql<boolean>`exists (select 1 from consents p where p.user_id = users.id and p.kind = 'privacy'
		and p.status = 'approved' and (p.valid_until is null or p.valid_until > ${at(now)}))`;

/** Under 18 on the UTC date of `now`, as `isMinor`; no birth date — an adult. */
export const minorSql = (now: Date) =>
	sql<boolean>`coalesce(users.birth_date > ${now.toISOString().slice(0, 10)}::date - interval '18 years', false)`;
