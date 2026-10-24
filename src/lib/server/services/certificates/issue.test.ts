import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { translate } from '#lib/i18n/translate.ts';
import { exams } from '../../db/schema/certification';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import type { Mail } from '../../mail/resend';
import { auditFor } from '../memberships/test-support';
import { insertMember } from '../registrations/test-support';
import { issueCertificate, type IssueCertificateInput } from './issue';
import {
	SETTINGS,
	certRow,
	certsOf,
	insertStaff,
	issuer,
	levelOf,
	passedExam
} from './test-support';

/* docs/03 section 4.3: an admin issues by a passed exam in one transaction — certificate, level,
 * audit; the letter after the commit (section 14). docs/04 section 8: a moderator cannot issue. */

const NUMBER = /^APU-\d{4}-\d{4,}$/;

describe.skipIf(!testDbUrl)('certificates: issue', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('a passed level exam: the certificate, the new level and the audit in one go', async () => {
		await inRollback(async (tx) => {
			const member = await insertMember(tx, { level: 'novice' });
			const exam = await passedExam(tx, member.id);
			const admin = await insertStaff(tx, 'admin');

			const result = await issuer(tx)(admin, {
				userId: member.id,
				kind: 'level',
				level: 'advanced',
				examId: exam.id
			});
			if (!result.ok) throw new Error(result.reason);
			expect(result.number).toMatch(NUMBER);
			expect(result.levelChanged).toBe(true);
			expect(await certRow(tx, result.id)).toMatchObject({
				userId: member.id,
				kind: 'level',
				level: 'advanced',
				category: null,
				status: 'active',
				number: result.number,
				publicToken: result.publicToken,
				examId: exam.id,
				issuedBy: admin.id,
				expiresAt: null,
				revokedAt: null
			});
			expect(await levelOf(tx, member.id)).toBe('advanced');
			const [issued] = await auditFor(tx, 'certificate', result.id);
			expect(issued).toMatchObject({
				action: 'certificate.issue',
				actorId: admin.id,
				after: {
					userId: member.id,
					kind: 'level',
					level: 'advanced',
					number: result.number,
					examId: exam.id,
					levelBefore: 'novice',
					levelAfter: 'advanced'
				}
			});
			expect(issued.ip).toBe('198.51.100.7');
			const levelEntries = (await auditFor(tx, 'user', member.id)).filter(
				(e) => e.action === 'user.level'
			);
			expect(levelEntries).toMatchObject([
				{ actorId: admin.id, before: { level: 'novice' }, after: { level: 'advanced' } }
			]);
		});
	});

	it('a coach without an exam: the comment goes to the audit, the end date from settings', async () => {
		await inRollback(async (tx) => {
			const member = await insertMember(tx, { level: 'novice' });
			const admin = await insertStaff(tx, 'admin');
			const issuedAt = new Date(Date.now() - 86_400_000);

			const result = await issuer(tx)(admin, {
				userId: member.id,
				kind: 'trainer',
				category: 'B',
				issuedAt,
				comment: 'Transfer of 2019 records'
			});
			if (!result.ok) throw new Error(result.reason);
			const row = await certRow(tx, result.id);
			expect(row).toMatchObject({ kind: 'trainer', level: null, category: 'B', examId: null, issuedAt });
			const expected = new Date(issuedAt);
			expected.setUTCMonth(expected.getUTCMonth() + SETTINGS.staffValidMonths);
			expect(row.expiresAt?.getTime()).toBe(expected.getTime());
			expect(result.levelChanged).toBe(false);
			expect(await levelOf(tx, member.id)).toBe('novice');
			const [issued] = await auditFor(tx, 'certificate', result.id);
			expect(issued.after).toMatchObject({ comment: 'Transfer of 2019 records', examId: null });
		});
	});

	it('refused for staff below admin, unknown or blocked members and exams that do not fit', async () => {
		await inRollback(async (tx) => {
			const member = await insertMember(tx, { level: 'novice' });
			const other = await insertMember(tx, { level: 'novice' });
			const blocked = await insertMember(tx, { level: 'novice', status: 'blocked' });
			const admin = await insertStaff(tx, 'admin');
			const issue = issuer(tx);
			const level = { kind: 'level' as const, level: 'advanced' as const };
			const advancedExam = (await passedExam(tx, member.id)).id;
			const trainerExam = (await passedExam(tx, member.id, 'trainer')).id;
			const moderator = await insertStaff(tx, 'moderator');
			const editor = await insertStaff(tx, 'editor');

			const cases: [typeof admin, IssueCertificateInput, string][] = [
				[moderator, { userId: member.id, ...level, examId: advancedExam }, 'not_allowed'],
				[editor, { userId: member.id, ...level, comment: 'x' }, 'not_allowed'],
				[admin, { userId: crypto.randomUUID(), ...level, comment: 'x' }, 'user_not_found'],
				[admin, { userId: blocked.id, ...level, comment: 'x' }, 'blocked'],
				[admin, { userId: member.id, ...level, examId: crypto.randomUUID() }, 'exam_not_found'],
				[admin, { userId: other.id, ...level, examId: advancedExam }, 'exam_mismatch'],
				[admin, { userId: member.id, ...level, examId: trainerExam }, 'exam_mismatch'],
				[admin, { userId: member.id, kind: 'trainer', examId: advancedExam }, 'exam_mismatch'],
				[admin, { userId: member.id, ...level }, 'comment_required']
			];
			for (const [actor, input, reason] of cases) {
				expect(await issue(actor, input), reason).toEqual({ ok: false, reason });
			}
			expect(await certsOf(tx, member.id)).toEqual([]);
			expect(await certsOf(tx, other.id)).toEqual([]);
			expect(await levelOf(tx, member.id)).toBe('novice');
		});
	});

	it('only a passed exam: scheduled, failed and cancelled are refused', async () => {
		await inRollback(async (tx) => {
			const member = await insertMember(tx, { level: 'novice' });
			const admin = await insertStaff(tx, 'admin');
			for (const result of ['scheduled', 'failed', 'cancelled'] as const) {
				const exam = await passedExam(tx, member.id);
				await tx.update(exams).set({ result }).where(eq(exams.id, exam.id));
				const refused = await issuer(tx)(admin, {
					userId: member.id,
					kind: 'level',
					level: 'advanced',
					examId: exam.id
				});
				expect(refused, result).toEqual({ ok: false, reason: 'exam_not_passed' });
			}
			expect(await certsOf(tx, member.id)).toEqual([]);
		});
	});

	it('twice for one exam or one level: the second is `already_issued`, one certificate', async () => {
		await inRollback(async (tx) => {
			const member = await insertMember(tx, { level: 'novice' });
			const exam = await passedExam(tx, member.id);
			const admin = await insertStaff(tx, 'admin');
			const input = { userId: member.id, kind: 'level' as const, level: 'advanced' as const };

			expect((await issuer(tx)(admin, { ...input, examId: exam.id })).ok).toBe(true);
			expect(await issuer(tx)(admin, { ...input, examId: exam.id })).toEqual({
				ok: false,
				reason: 'already_issued'
			});
			expect(await issuer(tx)(admin, { ...input, comment: 'Again' })).toEqual({
				ok: false,
				reason: 'already_issued'
			});
			expect(await certsOf(tx, member.id)).toHaveLength(1);
		});
	});

	it('the letter goes after the commit, in the member language, with number and links', async () => {
		await inRollback(async (tx) => {
			const member = await insertMember(tx, { level: 'novice', locale: 'ru', firstName: 'Арам' });
			const exam = await passedExam(tx, member.id);
			const admin = await insertStaff(tx, 'admin');
			const letters: Mail[] = [];

			const result = await issuer(tx, letters)(admin, {
				userId: member.id,
				kind: 'level',
				level: 'advanced',
				examId: exam.id
			});
			if (!result.ok) throw new Error(result.reason);
			expect(letters).toHaveLength(1);
			const [mail] = letters;
			expect(mail.to).toBe(member.email);
			expect(mail.subject).toBe(
				translate('ru', 'certificates.mail.issued.subject', { number: result.number })
			);
			expect(mail.text).toContain('Арам');
			expect(mail.text).toContain(result.number);
			expect(mail.text).toContain(translate('ru', 'certificates.kind.level_advanced'));
			expect(mail.text).toContain(`https://parkour.test/ru/certificate/${result.publicToken}`);
			expect(mail.text).toContain('https://parkour.test/ru/cabinet/progress');
		});
	});

	it('a failed send does not undo the issue; no letter on a refusal; without `send` none', async () => {
		await inRollback(async (tx) => {
			const member = await insertMember(tx, { level: 'novice' });
			const admin = await insertStaff(tx, 'admin');
			const deps = {
				settings: SETTINGS,
				send: async () => {
					throw new Error('mail down');
				},
				siteUrl: undefined
			};
			const input = { userId: member.id, kind: 'judge' as const, comment: 'Transfer' };
			const result = await issueCertificate(tx, admin, input, deps, null);
			expect(result.ok).toBe(true);
			expect(await certsOf(tx, member.id)).toHaveLength(1);

			const letters: Mail[] = [];
			const nobody = await insertUser(tx);
			expect((await issuer(tx, letters)(admin, { ...input, userId: nobody.id, examId: crypto.randomUUID() })).ok).toBe(false);
			expect(letters).toEqual([]);
		});
	});
});
