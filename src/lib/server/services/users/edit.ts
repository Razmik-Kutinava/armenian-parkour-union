import { eq } from 'drizzle-orm';
import { isMinor } from '#lib/validation/auth.ts';
import type { NewUserInput, ProfileInput } from '#lib/validation/admin-users.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { users } from '../../db/schema/users';
import { writeAudit } from '../audit';
import { isUuid, type Actor } from './target';

/** Form input → columns. Parent data only for minors (docs/03 section 13); blank fields → null. */
function profileColumns(data: ProfileInput, today: Date) {
	const minor = isMinor(data.birthDate, today);
	return {
		name: `${data.firstName} ${data.lastName}`,
		firstName: data.firstName,
		lastName: data.lastName,
		birthDate: data.birthDate,
		phone: data.phone ?? null,
		city: data.city ?? null,
		guardianName: minor ? (data.guardianName ?? null) : null,
		guardianPhone: minor ? (data.guardianPhone ?? null) : null,
		guardianEmail: minor ? (data.guardianEmail ?? null) : null
	};
}
type Columns = ReturnType<typeof profileColumns>;

export type CreateResult = { ok: true; id: string } | { ok: false; error: 'exists' | 'not_admin' };

/** Manual creation (docs/05 section 6): no password; the user sets it from the mailed link. */
export async function createUser(
	db: LimitDb,
	actor: Actor,
	data: NewUserInput,
	ip: string | null,
	today = new Date()
): Promise<CreateResult> {
	if (actor.role !== 'admin') return { ok: false, error: 'not_admin' };
	return db.transaction(async (tx) => {
		const values = { email: data.email, ...profileColumns(data, today) };
		const [row] = await tx
			.insert(users)
			.values(values)
			.onConflictDoNothing({ target: users.email })
			.returning({ id: users.id });
		if (!row) return { ok: false, error: 'exists' } as const;
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'user.create',
			entityType: 'user',
			entityId: row.id,
			after: values,
			ip
		});
		return { ok: true, id: row.id } as const;
	});
}

/** Saves the profile; the audit entry holds only the fields that changed. */
export async function updateProfile(
	db: LimitDb,
	actor: Actor,
	id: string,
	data: ProfileInput,
	ip: string | null,
	today = new Date()
): Promise<'ok' | 'not_found' | 'not_admin'> {
	if (actor.role !== 'admin') return 'not_admin';
	if (!isUuid(id)) return 'not_found';
	return db.transaction(async (tx) => {
		const next = profileColumns(data, today);
		const [current] = await tx
			.select({
				name: users.name,
				firstName: users.firstName,
				lastName: users.lastName,
				birthDate: users.birthDate,
				phone: users.phone,
				city: users.city,
				guardianName: users.guardianName,
				guardianPhone: users.guardianPhone,
				guardianEmail: users.guardianEmail,
				deletedAt: users.deletedAt
			})
			.from(users)
			.where(eq(users.id, id))
			.for('update');
		if (!current || current.deletedAt) return 'not_found';
		const keys = (Object.keys(next) as (keyof Columns)[]).filter((k) => current[k] !== next[k]);
		if (keys.length === 0) return 'ok';
		await tx.update(users).set(next).where(eq(users.id, id));
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'user.update',
			entityType: 'user',
			entityId: id,
			before: Object.fromEntries(keys.map((k) => [k, current[k]])),
			after: Object.fromEntries(keys.map((k) => [k, next[k]])),
			ip
		});
		return 'ok';
	});
}
