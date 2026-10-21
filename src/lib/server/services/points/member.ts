import { and, isNull, sql } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { users } from '../../db/schema/users';

export type PointsMember = { id: string; name: string | null; email: string; balance: number };

/** docs/05 section 12: the member of a manual adjustment, found by email, with the balance now. */
export async function findMember(db: LimitDb, email: string): Promise<PointsMember | null> {
	const [row] = await db
		.select({ id: users.id, name: users.name, email: users.email, balance: users.pointsBalance })
		.from(users)
		.where(and(sql`lower(${users.email}) = ${email.toLowerCase()}`, isNull(users.deletedAt)));
	return row ?? null;
}
