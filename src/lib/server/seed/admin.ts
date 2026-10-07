import { hashPassword } from 'better-auth/crypto';
import { eq } from 'drizzle-orm';
import { email as emailSchema, PASSWORD_MAX, PASSWORD_MIN } from '#lib/validation/auth.ts';
import type { LimitDb } from '../auth/rate-limit';
import { account } from '../db/schema/auth';
import { users } from '../db/schema/users';
import { writeAudit } from '../services/audit';
import { lockActiveAdmins } from '../services/users/target';

export type SeedAdminResult = 'skipped_no_env' | 'skipped_admin_exists' | 'created' | 'promoted';

/**
 * docs/04 section 6.1: the first admin comes only from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
 * Runs only while there is no active admin, so the variables cannot add admins later.
 */
export async function seedAdmin(
	db: LimitDb,
	input: { email?: string; password?: string }
): Promise<SeedAdminResult> {
	if (!input.email || !input.password) return 'skipped_no_env';
	const parsed = emailSchema.safeParse(input.email);
	if (!parsed.success) throw new Error('SEED_ADMIN_EMAIL is not a valid email');
	const { password } = input;
	if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
		throw new Error(`SEED_ADMIN_PASSWORD must be ${PASSWORD_MIN}-${PASSWORD_MAX} characters`);
	}
	const email = parsed.data;

	return db.transaction(async (tx) => {
		if ((await lockActiveAdmins(tx)) > 0) return 'skipped_admin_exists';
		const [existing] = await tx
			.select({ id: users.id, role: users.role, status: users.status, deletedAt: users.deletedAt })
			.from(users)
			.where(eq(users.email, email))
			.for('update');

		if (existing) {
			if (existing.status !== 'active' || existing.deletedAt) {
				throw new Error('SEED_ADMIN_EMAIL belongs to a blocked or deleted account');
			}
			await tx.update(users).set({ role: 'admin' }).where(eq(users.id, existing.id));
			await writeAudit(tx, {
				actorId: null,
				action: 'user.role_change',
				entityType: 'user',
				entityId: existing.id,
				before: { role: existing.role },
				after: { role: 'admin' }
			});
			return 'promoted';
		}

		const [user] = await tx
			.insert(users)
			.values({ email, name: 'Admin', role: 'admin', emailVerified: true })
			.returning({ id: users.id });
		await tx.insert(account).values({
			userId: user.id,
			accountId: user.id,
			providerId: 'credential',
			password: await hashPassword(password)
		});
		await writeAudit(tx, {
			actorId: null,
			action: 'user.create',
			entityType: 'user',
			entityId: user.id,
			after: { email, role: 'admin', source: 'seed' }
		});
		return 'created';
	});
}
