import { and, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { auditLog } from '../../db/schema/service';
import { users } from '../../db/schema/users';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { createUser, updateProfile } from './edit';

const IP = '198.51.100.2';
const TODAY = new Date('2026-10-07T12:00:00Z');

describe.skipIf(!testDbUrl)('create and edit users (docs/05 section 6)', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	const admin = async (tx: LimitDb) => ({
		id: (await insertUser(tx, { role: 'admin' })).id,
		role: 'admin' as const
	});
	const userRow = async (tx: LimitDb, id: string) =>
		(await tx.select().from(users).where(eq(users.id, id)))[0];
	const auditOf = (tx: LimitDb, id: string, action: string) =>
		tx
			.select()
			.from(auditLog)
			.where(and(eq(auditLog.entityId, id), eq(auditLog.action, action)));

	const adult = {
		firstName: 'Ani',
		lastName: 'Petrosyan',
		birthDate: '1995-03-03',
		phone: '+37491000010',
		city: 'Vanadzor'
	};

	it('creates an active member without a password and logs it', async () => {
		await inRollback(async (tx) => {
			const actor = await admin(tx);
			const email = `t-${crypto.randomUUID()}@example.com`;
			const result = await createUser(tx, actor, { ...adult, email }, IP, TODAY);
			if (!result.ok) throw new Error('expected ok');
			const row = await userRow(tx, result.id);
			expect(row).toMatchObject({
				email,
				name: 'Ani Petrosyan',
				role: 'member',
				status: 'active',
				emailVerified: false,
				city: 'Vanadzor'
			});
			const [entry] = await auditOf(tx, result.id, 'user.create');
			expect(entry).toMatchObject({ actorId: actor.id, ip: IP });
		});
	});

	it('an existing email is reported, not duplicated', async () => {
		await inRollback(async (tx) => {
			const actor = await admin(tx);
			const existing = await insertUser(tx);
			const result = await createUser(tx, actor, { ...adult, email: existing.email }, IP, TODAY);
			expect(result).toEqual({ ok: false, error: 'exists' });
		});
	});

	it('parent data is kept only for minors (docs/03 section 13)', async () => {
		await inRollback(async (tx) => {
			const actor = await admin(tx);
			const guardian = {
				guardianName: 'Parent',
				guardianPhone: '+37491000011',
				guardianEmail: 'p@example.com'
			};
			const email = `t-${crypto.randomUUID()}@example.com`;
			const result = await createUser(tx, actor, { ...adult, ...guardian, email }, IP, TODAY);
			if (!result.ok) throw new Error('expected ok');
			expect((await userRow(tx, result.id)).guardianName).toBeNull();
		});
	});

	it('profile edit stores the change and logs only changed fields', async () => {
		await inRollback(async (tx) => {
			const actor = await admin(tx);
			const u = await insertUser(tx, { ...adult, name: 'Ani Petrosyan' });
			const edited = { ...adult, city: 'Gyumri' };
			expect(await updateProfile(tx, actor, u.id, edited, IP, TODAY)).toBe('ok');
			const row = await userRow(tx, u.id);
			expect(row.city).toBe('Gyumri');
			expect(row.name).toBe('Ani Petrosyan');
			const [entry] = await auditOf(tx, u.id, 'user.update');
			expect(entry.before).toEqual({ city: 'Vanadzor' });
			expect(entry.after).toEqual({ city: 'Gyumri' });
		});
	});

	it('nothing changed → no audit entry; non-admin or unknown user → refused', async () => {
		await inRollback(async (tx) => {
			const actor = await admin(tx);
			const u = await insertUser(tx, { ...adult, name: 'Ani Petrosyan' });
			expect(await updateProfile(tx, actor, u.id, adult, IP, TODAY)).toBe('ok');
			expect(await auditOf(tx, u.id, 'user.update')).toHaveLength(0);
			const asMod = { id: actor.id, role: 'moderator' as const };
			expect(await updateProfile(tx, asMod, u.id, adult, IP, TODAY)).toBe('not_admin');
			expect(await updateProfile(tx, actor, 'x', adult, IP, TODAY)).toBe('not_found');
		});
	});
});
