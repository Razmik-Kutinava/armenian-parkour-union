import { and, eq } from 'drizzle-orm';
import { hashPassword, verifyPassword } from 'better-auth/crypto';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../auth/rate-limit';
import { account } from '../db/schema/auth';
import { auditLog } from '../db/schema/service';
import { users } from '../db/schema/users';
import { insertUser, testDb, testDbUrl } from '../db/test-db';
import { seedAdmin } from './admin';

const PASSWORD = 'seed-admin-pass-1';
const newEmail = () => `seed-${crypto.randomUUID()}@example.com`;

/* docs/04 section 6.1: the first admin comes only from the seed script. */
async function noAdmins(tx: LimitDb) {
	await tx.update(users).set({ role: 'member' }).where(eq(users.role, 'admin'));
}

async function userByEmail(tx: LimitDb, email: string) {
	const [row] = await tx.select().from(users).where(eq(users.email, email));
	return row;
}

async function auditOf(tx: LimitDb, userId: string) {
	return tx.select().from(auditLog).where(eq(auditLog.entityId, userId));
}

describe.skipIf(!testDbUrl)('seed: first admin', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('skips without SEED_ADMIN_EMAIL or SEED_ADMIN_PASSWORD', async () => {
		await inRollback(async (tx) => {
			await noAdmins(tx);
			expect(await seedAdmin(tx, {})).toBe('skipped_no_env');
			expect(await seedAdmin(tx, { email: newEmail() })).toBe('skipped_no_env');
			expect(await seedAdmin(tx, { password: PASSWORD })).toBe('skipped_no_env');
		});
	});

	it('skips when an active admin already exists', async () => {
		await inRollback(async (tx) => {
			await insertUser(tx, { role: 'admin' });
			const email = newEmail();
			expect(await seedAdmin(tx, { email, password: PASSWORD })).toBe('skipped_admin_exists');
			expect(await userByEmail(tx, email)).toBeUndefined();
		});
	});

	it('creates a verified admin with a Better Auth password and a system audit entry', async () => {
		await inRollback(async (tx) => {
			await noAdmins(tx);
			const email = newEmail();
			const result = await seedAdmin(tx, { email: ` ${email.toUpperCase()} `, password: PASSWORD });
			expect(result).toBe('created');

			const user = await userByEmail(tx, email);
			expect(user).toMatchObject({ role: 'admin', status: 'active', emailVerified: true });
			const [cred] = await tx
				.select()
				.from(account)
				.where(and(eq(account.userId, user.id), eq(account.providerId, 'credential')));
			expect(cred.accountId).toBe(user.id);
			expect(await verifyPassword({ hash: cred.password ?? '', password: PASSWORD })).toBe(true);

			const [entry] = await auditOf(tx, user.id);
			expect(entry).toMatchObject({ actorId: null, action: 'user.create', entityType: 'user' });
		});
	});

	it('a second run changes nothing', async () => {
		await inRollback(async (tx) => {
			await noAdmins(tx);
			const email = newEmail();
			await seedAdmin(tx, { email, password: PASSWORD });
			expect(await seedAdmin(tx, { email, password: 'other-pass-123' })).toBe(
				'skipped_admin_exists'
			);
		});
	});

	async function memberWithPassword(tx: LimitDb, password: string) {
		const member = await insertUser(tx);
		await tx.insert(account).values({
			userId: member.id,
			accountId: member.id,
			providerId: 'credential',
			password: await hashPassword(password)
		});
		return member;
	}

	it('promotes an existing active account only with its own password', async () => {
		await inRollback(async (tx) => {
			await noAdmins(tx);
			const member = await memberWithPassword(tx, PASSWORD);
			expect(await seedAdmin(tx, { email: member.email, password: PASSWORD })).toBe('promoted');
			expect((await userByEmail(tx, member.email)).role).toBe('admin');
			const [entry] = await auditOf(tx, member.id);
			expect(entry).toMatchObject({
				actorId: null,
				action: 'user.role_change',
				before: { role: 'member' },
				after: { role: 'admin' }
			});
		});
	});

	/* C7: someone registers the future admin email first; the seed must not hand them admin. */
	it('refuses to promote an account whose password is not SEED_ADMIN_PASSWORD', async () => {
		await inRollback(async (tx) => {
			await noAdmins(tx);
			const squatter = await memberWithPassword(tx, 'squatter-pass-1');
			await expect(seedAdmin(tx, { email: squatter.email, password: PASSWORD })).rejects.toThrow();
			const noPassword = await insertUser(tx);
			await expect(
				seedAdmin(tx, { email: noPassword.email, password: PASSWORD })
			).rejects.toThrow();
			expect((await userByEmail(tx, squatter.email)).role).toBe('member');
			expect((await userByEmail(tx, noPassword.email)).role).toBe('member');
		});
	});

	it('refuses a blocked or deleted account', async () => {
		await inRollback(async (tx) => {
			await noAdmins(tx);
			const blocked = await insertUser(tx, { status: 'blocked' });
			await expect(seedAdmin(tx, { email: blocked.email, password: PASSWORD })).rejects.toThrow();
			const deleted = await insertUser(tx, { deletedAt: new Date() });
			await expect(seedAdmin(tx, { email: deleted.email, password: PASSWORD })).rejects.toThrow();
		});
	});

	it('refuses a bad email or a password outside the length limits', async () => {
		await inRollback(async (tx) => {
			await noAdmins(tx);
			await expect(seedAdmin(tx, { email: 'not-an-email', password: PASSWORD })).rejects.toThrow();
			await expect(seedAdmin(tx, { email: newEmail(), password: 'short' })).rejects.toThrow();
			await expect(
				seedAdmin(tx, { email: newEmail(), password: 'x'.repeat(129) })
			).rejects.toThrow();
		});
	});
});
