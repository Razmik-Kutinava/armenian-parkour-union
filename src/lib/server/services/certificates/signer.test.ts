import { and, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { auditLog, siteSettings } from '../../db/schema/service';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { certificateSettings, saveCertificateSigner } from './settings';

/* questions.md stage 6 (2026-10-26): the signer's name and title live in
 * `site_settings.certificates`; docs/05 section 21: admin only, every change in audit_log. */

const SIGNER = {
	name: { hy: 'Ռազմիկ Գյուրջյան', en: 'Razmik Giurdzian', ru: 'Размик Гюрджян' },
	title: { hy: 'ֆեդերացիայի ղեկավար', en: 'Head of the Federation', ru: 'руководитель федерации' }
};
const STORED = { staff_valid_months: 36, pdf_russian: false, staff_remind_days: [14] };

type Tx = Parameters<typeof insertUser>[0];
const storeCertificates = (tx: Tx, value: unknown) =>
	tx
		.insert(siteSettings)
		.values({ key: 'certificates', value })
		.onConflictDoUpdate({ target: siteSettings.key, set: { value } });
const stored = async (tx: Tx) => {
	const [row] = await tx.select().from(siteSettings).where(eq(siteSettings.key, 'certificates'));
	return row?.value;
};

describe.skipIf(!testDbUrl)('certificates: the signer setting', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('an admin saves the signer: the other fields stay, it reads back, the change is logged', async () => {
		await inRollback(async (tx) => {
			await storeCertificates(tx, STORED);
			const { id } = await insertUser(tx, { role: 'admin' });
			expect(await saveCertificateSigner(tx, { id, role: 'admin' }, SIGNER, '10.0.0.5')).toBe('ok');
			expect(await stored(tx)).toEqual({ ...STORED, signer: SIGNER });
			const settings = await certificateSettings(tx);
			expect(settings).toMatchObject({ staffValidMonths: 36, pdfRussian: false, signer: SIGNER });
			const [entry] = await tx
				.select()
				.from(auditLog)
				.where(and(eq(auditLog.actorId, id), eq(auditLog.action, 'settings.update')));
			expect(entry.after).toEqual({ certificates: { ...STORED, signer: SIGNER } });
			expect(entry.ip).toBe('10.0.0.5');
		});
	});

	it('cleared: the PDF goes back to the plain "Signature"', async () => {
		await inRollback(async (tx) => {
			await storeCertificates(tx, { ...STORED, signer: SIGNER });
			const { id } = await insertUser(tx, { role: 'admin' });
			expect(await saveCertificateSigner(tx, { id, role: 'admin' }, null, null)).toBe('ok');
			expect(await stored(tx)).toEqual(STORED);
			expect((await certificateSettings(tx)).signer).toBeNull();
		});
	});

	it('a moderator or editor may not; nothing is stored', async () => {
		await inRollback(async (tx) => {
			await storeCertificates(tx, STORED);
			for (const role of ['moderator', 'editor'] as const) {
				const { id } = await insertUser(tx, { role });
				expect(await saveCertificateSigner(tx, { id, role }, SIGNER, null)).toBe('not_admin');
			}
			expect(await stored(tx)).toEqual(STORED);
		});
	});
});
