import { afterAll, describe, expect, it } from 'vitest';
import { translate } from '#lib/i18n/translate.ts';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import type { Mail } from '../../mail/resend';
import { insertMember } from '../registrations/test-support';
import { issueCertificate } from './issue';
import { SETTINGS, certsOf, insertStaff, issuer, passedExam } from './test-support';

/* docs/03 section 14: "a certificate is issued" goes after the commit; a failed send never undoes
 * the issue. */

describe.skipIf(!testDbUrl)('certificates: issue letter', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

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

	it('a failed send does not undo the issue; no letter on a refusal', async () => {
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
			const refused = await issuer(tx, letters)(admin, {
				...input,
				userId: nobody.id,
				examId: crypto.randomUUID()
			});
			expect(refused.ok).toBe(false);
			expect(letters).toEqual([]);
		});
	});
});
