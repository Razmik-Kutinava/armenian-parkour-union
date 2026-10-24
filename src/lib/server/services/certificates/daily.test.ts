import { and, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { staffProfiles } from '../../db/schema/certification';
import { testDb, testDbUrl } from '../../db/test-db';
import type { Mail } from '../../mail/resend';
import { auditFor } from '../memberships/test-support';
import { insertMember } from '../registrations/test-support';
import { runCertificateDaily } from './daily';
import { certRow, daysFrom, insertCertificate, insertStaff } from './test-support';

/* docs/03 section 4.6, 5.3, 14: a coach or judge certificate past `expires_at` becomes `expired`
 * and its profile is switched off; letters go 30 and 7 days before the end (questions.md
 * stage 6, 6.9) in the member's language, after the mark, never twice; level certificates and
 * revoked ones are left alone. The sweep sees the whole table — assertions look at own rows. */

const NOW = new Date();
const SITE = 'https://parkour.test';

describe.skipIf(!testDbUrl)('certificates: daily job', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	function runner(tx: LimitDb, letters: Mail[], fail = false) {
		return (now = NOW) =>
			runCertificateDaily(tx, {
				send: async (mail) => {
					if (fail) throw new Error('mail down');
					letters.push(mail);
				},
				siteUrl: SITE,
				remindDays: [30, 7],
				now
			});
	}

	type Holder = { id: string; email: string };

	async function staffCert(
		tx: LimitDb,
		issuedBy: string,
		expiresInDays: number,
		values: Partial<Parameters<typeof insertCertificate>[1]> = {},
		holder?: Holder
	) {
		const member = holder ?? (await insertMember(tx, { locale: 'ru' }));
		const cert = await insertCertificate(tx, {
			kind: 'trainer',
			issuedBy,
			issuedAt: daysFrom(NOW, -700),
			expiresAt: daysFrom(NOW, expiresInDays),
			...values,
			userId: member.id
		});
		return { cert, userId: member.id, email: member.email };
	}

	const lettersTo = (letters: Mail[], email: string) => letters.filter((m) => m.to === email);

	it('an ended coach certificate expires, its profile goes off; logged as the system, once', async () => {
		await inRollback(async (tx) => {
			const admin = await insertStaff(tx, 'admin');
			const ended = await staffCert(tx, admin.id, -1);
			await tx.insert(staffProfiles).values({ userId: ended.userId, kind: 'trainer' });
			const live = await staffCert(tx, admin.id, 100);
			const revoked = await staffCert(tx, admin.id, -2, {
				status: 'revoked',
				revokedAt: daysFrom(NOW, -10),
				revokeReason: 'Test'
			});
			const level = await staffCert(tx, admin.id, 0, {
				kind: 'level',
				level: 'advanced',
				expiresAt: null
			});

			const run = runner(tx, []);
			const summary = await run();
			expect(summary.expired).toBeGreaterThanOrEqual(1);
			expect(summary.deactivated).toBeGreaterThanOrEqual(1);

			expect(await certRow(tx, ended.cert.id)).toMatchObject({ status: 'expired' });
			expect(await certRow(tx, live.cert.id)).toMatchObject({ status: 'active' });
			expect(await certRow(tx, revoked.cert.id)).toMatchObject({ status: 'revoked' });
			expect(await certRow(tx, level.cert.id)).toMatchObject({ status: 'active' });
			const [profile] = await tx
				.select()
				.from(staffProfiles)
				.where(and(eq(staffProfiles.userId, ended.userId), eq(staffProfiles.kind, 'trainer')));
			expect(profile.isActive).toBe(false);

			const entries = await auditFor(tx, 'certificate', ended.cert.id);
			expect(entries).toHaveLength(1);
			expect(entries[0]).toMatchObject({
				actorId: null,
				action: 'certificate.expire',
				before: { status: 'active' },
				after: { status: 'expired', userId: ended.userId, kind: 'trainer' }
			});

			await run();
			expect(await auditFor(tx, 'certificate', ended.cert.id)).toHaveLength(1);
		});
	});

	it('30 days ahead, then 7 days ahead — one letter each, in the member language; a rerun sends nothing', async () => {
		await inRollback(async (tx) => {
			const admin = await insertStaff(tx, 'admin');
			const soon = await staffCert(tx, admin.id, 20, { kind: 'judge' });
			const letters: Mail[] = [];
			const run = runner(tx, letters);

			await run();
			const [first] = lettersTo(letters, soon.email);
			expect(lettersTo(letters, soon.email)).toHaveLength(1);
			expect(first.subject).toContain(soon.cert.number);
			expect(first.text).toContain('Здравствуйте');
			expect(first.text).toContain(`${SITE}/ru/cabinet/progress`);
			expect(await certRow(tx, soon.cert.id)).toMatchObject({ remindedDays: 30 });

			await run();
			expect(lettersTo(letters, soon.email)).toHaveLength(1);

			await run(daysFrom(NOW, 14));
			expect(lettersTo(letters, soon.email)).toHaveLength(2);
			expect(await certRow(tx, soon.cert.id)).toMatchObject({ remindedDays: 7 });
			await run(daysFrom(NOW, 15));
			expect(lettersTo(letters, soon.email)).toHaveLength(2);
		});
	});

	it('a short term gets one letter, not two', async () => {
		await inRollback(async (tx) => {
			const admin = await insertStaff(tx, 'admin');
			const short = await staffCert(tx, admin.id, 3);
			const letters: Mail[] = [];
			await runner(tx, letters)();
			expect(lettersTo(letters, short.email)).toHaveLength(1);
			expect(await certRow(tx, short.cert.id)).toMatchObject({ remindedDays: 7 });
		});
	});

	it('no letter: far off, revoked, blocked or deleted holder, already renewed', async () => {
		await inRollback(async (tx) => {
			const admin = await insertStaff(tx, 'admin');
			const far = await staffCert(tx, admin.id, 45);
			const revoked = await staffCert(tx, admin.id, 10, {
				status: 'revoked',
				revokedAt: NOW,
				revokeReason: 'Test'
			});
			const blocked = await staffCert(
				tx,
				admin.id,
				10,
				{},
				await insertMember(tx, { status: 'blocked' })
			);
			const deleted = await staffCert(
				tx,
				admin.id,
				10,
				{},
				await insertMember(tx, { deletedAt: NOW })
			);
			const renewed = await staffCert(tx, admin.id, 10);
			await insertCertificate(tx, {
				userId: renewed.userId,
				kind: 'trainer',
				issuedBy: admin.id,
				expiresAt: daysFrom(NOW, 700)
			});

			const letters: Mail[] = [];
			await runner(tx, letters)();
			for (const c of [far, revoked, blocked, deleted, renewed]) {
				expect(lettersTo(letters, c.email), c.email).toHaveLength(0);
				expect((await certRow(tx, c.cert.id)).remindedDays).toBeNull();
			}
		});
	});

	it('a failed send does not stop the job; the mark stays, so no retry storm', async () => {
		await inRollback(async (tx) => {
			const admin = await insertStaff(tx, 'admin');
			const soon = await staffCert(tx, admin.id, 5);
			const ended = await staffCert(tx, admin.id, -1);
			const summary = await runner(tx, [], true)();
			expect(summary.reminded).toBeGreaterThanOrEqual(1);
			expect(await certRow(tx, soon.cert.id)).toMatchObject({ remindedDays: 7 });
			expect(await certRow(tx, ended.cert.id)).toMatchObject({ status: 'expired' });
		});
	});
});
