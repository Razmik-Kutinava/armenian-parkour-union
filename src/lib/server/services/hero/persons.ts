import { and, asc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { users } from '../../db/schema/users';
import type { Actor } from '../users/target';

/* decisions.md 2026-10-08 (2.6): a person block shows only an active adult, by birth date (K4). */

export const adultPerson = and(
	eq(users.status, 'active'),
	isNull(users.deletedAt),
	sql`${users.birthDate} <= (current_date - interval '18 years')::date`
);

export type HeroPerson = { id: string; name: string; avatarKey: string | null };

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** By name only: the editor gets no contacts or birth dates of members. */
export async function searchHeroPersons(
	db: LimitDb,
	actor: Actor,
	query: string,
	limit = 10
): Promise<HeroPerson[] | 'not_allowed'> {
	if (!roleCan(actor.role, 'hero.write')) return 'not_allowed';
	const q = query.trim().slice(0, 100);
	if (!q) return [];
	const like = `%${escapeLike(q)}%`;
	return db
		.select({ id: users.id, name: users.name, avatarKey: users.avatarKey })
		.from(users)
		.where(and(adultPerson, or(ilike(users.name, like), ilike(users.lastName, like))))
		.orderBy(asc(users.name))
		.limit(limit);
}

export async function getHeroPerson(db: LimitDb, id: string): Promise<HeroPerson | null> {
	const [row] = await db
		.select({ id: users.id, name: users.name, avatarKey: users.avatarKey })
		.from(users)
		.where(eq(users.id, id));
	return row ?? null;
}
