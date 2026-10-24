import { eq } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { certificates } from '../../db/schema/certification';
import type { Mail } from '../../mail/resend';
import { insertExam } from '../exams/test-support';
import type { Actor } from '../users/target';
import { issueCertificate, type IssueCertificateInput } from './issue';
import type { CertificateSettings } from './settings';

/* Test support only: certificate tests run inside a rolled-back transaction; settings are passed in. */

export { IP, daysFrom, insertCertificate, insertStaff, levelOf } from '../exams/test-support';

export const SETTINGS: CertificateSettings = {
	staffValidMonths: 24,
	pdfRussian: true,
	staffRemindDays: [30, 7]
};

const png = (base64: string) => new Uint8Array(Buffer.from(base64, 'base64'));

/** Two different 1 × 1 PNGs standing in for the seal and the signature (the real ones stay private). */
export const TEST_IMAGES = {
	seal: png(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
	),
	signature: png(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
	)
};

export async function passedExam(
	tx: LimitDb,
	userId: string,
	kind: 'level_advanced' | 'level_pro' | 'trainer' | 'judge' = 'level_advanced'
) {
	return insertExam(tx, { userId, kind, result: 'passed', decidedAt: new Date(), score: '90.00' });
}

/** Issues with the test settings; `letters` collects what would be sent. */
export function issuer(tx: LimitDb, letters?: Mail[]) {
	return (actor: Actor, input: IssueCertificateInput, now = new Date()) =>
		issueCertificate(
			tx,
			actor,
			input,
			letters
				? {
						settings: SETTINGS,
						send: async (mail) => void letters.push(mail),
						siteUrl: 'https://parkour.test'
					}
				: { settings: SETTINGS },
			'198.51.100.7',
			now
		);
}

export async function certRow(tx: LimitDb, id: string) {
	const [row] = await tx.select().from(certificates).where(eq(certificates.id, id));
	return row;
}

export async function certsOf(tx: LimitDb, userId: string) {
	return tx.select().from(certificates).where(eq(certificates.userId, userId));
}
