import { afterAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { certificates } from '../../db/schema/certification';
import { users } from '../../db/schema/users';
import { testDb, testDbUrl } from '../../db/test-db';
import { insertMember } from '../registrations/test-support';
import { findPublicCertificate } from './public';
import { daysFrom, insertCertificate, insertStaff } from './test-support';

/* docs/06 section 4.10, docs/03 section 4 p. 5: anyone with the link sees the name, type and level,
 * number, dates and status — never contacts, the birth date or why it was revoked. */

const NOW = new Date('2026-06-01T12:00:00Z');

describe.skipIf(!testDbUrl)('certificates: public check', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	async function setup(tx: Parameters<typeof insertMember>[0]) {
		const member = await insertMember(tx, {
			name: 'aram-login',
			firstName: 'Aram',
			lastName: 'Petrosyan',
			birthDate: '2010-04-02'
		});
		const admin = await insertStaff(tx, 'admin');
		return { member, admin };
	}

	it('an active level certificate: name, type and level, number, date — and nothing else', async () => {
		await inRollback(async (tx) => {
			const { member, admin } = await setup(tx);
			const cert = await insertCertificate(tx, {
				userId: member.id,
				issuedBy: admin.id,
				kind: 'level',
				level: 'advanced',
				issuedAt: daysFrom(NOW, -10)
			});

			expect(await findPublicCertificate(tx, cert.publicToken, NOW)).toEqual({
				holder: 'Aram Petrosyan',
				kind: 'level',
				level: 'advanced',
				category: null,
				number: cert.number,
				issuedAt: cert.issuedAt,
				expiresAt: null,
				state: 'active'
			});
		});
	});

	it('a coach certificate: category and "valid until"; expired by the date before the daily job', async () => {
		await inRollback(async (tx) => {
			const { member, admin } = await setup(tx);
			const cert = await insertCertificate(tx, {
				userId: member.id,
				issuedBy: admin.id,
				kind: 'trainer',
				category: 'Kids',
				issuedAt: daysFrom(NOW, -800),
				expiresAt: daysFrom(NOW, -70)
			});

			expect(await findPublicCertificate(tx, cert.publicToken, NOW)).toMatchObject({
				kind: 'trainer',
				category: 'Kids',
				expiresAt: cert.expiresAt,
				state: 'expired'
			});
			expect(await findPublicCertificate(tx, cert.publicToken, daysFrom(NOW, -100))).toMatchObject(
				{ state: 'active' }
			);
		});
	});

	it('revoked: the status shows, the reason does not', async () => {
		await inRollback(async (tx) => {
			const { member, admin } = await setup(tx);
			const cert = await insertCertificate(tx, {
				userId: member.id,
				issuedBy: admin.id,
				kind: 'judge',
				issuedAt: daysFrom(NOW, -30),
				expiresAt: daysFrom(NOW, 300),
				status: 'revoked',
				revokedAt: daysFrom(NOW, -1),
				revokeReason: 'Secret disciplinary note'
			});

			const found = await findPublicCertificate(tx, cert.publicToken, NOW);
			expect(found).toMatchObject({ state: 'revoked' });
			expect(JSON.stringify(found)).not.toContain('Secret disciplinary note');
		});
	});

	it('no first and last name — the account name', async () => {
		await inRollback(async (tx) => {
			const { admin } = await setup(tx);
			const member = await insertMember(tx, { name: 'Gor', firstName: null, lastName: null });
			const cert = await insertCertificate(tx, {
				userId: member.id,
				issuedBy: admin.id,
				kind: 'level',
				level: 'pro'
			});
			expect(await findPublicCertificate(tx, cert.publicToken, NOW)).toMatchObject({
				holder: 'Gor'
			});
		});
	});

	it('unknown, malformed or deleted owner — not found', async () => {
		await inRollback(async (tx) => {
			const { member, admin } = await setup(tx);
			const cert = await insertCertificate(tx, {
				userId: member.id,
				issuedBy: admin.id,
				kind: 'level',
				level: 'advanced'
			});

			expect(await findPublicCertificate(tx, 'no-such-token', NOW)).toBeNull();
			expect(await findPublicCertificate(tx, '', NOW)).toBeNull();
			expect(await findPublicCertificate(tx, "x' or '1'='1", NOW)).toBeNull();
			expect(await findPublicCertificate(tx, 'a'.repeat(65), NOW)).toBeNull();

			await tx.update(users).set({ deletedAt: NOW }).where(eq(users.id, member.id));
			expect(await findPublicCertificate(tx, cert.publicToken, NOW)).toBeNull();
			const [row] = await tx.select().from(certificates).where(eq(certificates.id, cert.id));
			expect(row.status).toBe('active');
		});
	});
});
