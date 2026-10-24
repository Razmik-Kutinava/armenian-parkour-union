import { afterAll, describe, expect, it } from 'vitest';
import { testDb, testDbUrl } from '../../db/test-db';
import {
	certificateYear,
	formatCertificateNumber,
	newPublicToken,
	nextCertificateNumber
} from './number';
import { insertCertificate, insertStaff } from './test-support';

/* docs/03 section 4.4: `APU-{year}-{4-digit sequence}`, unique, never reused (a revoked number
 * stays taken). The year is the issue date in Yerevan. */

describe('certificates: number format', () => {
	it('four digits with zeros, more after 9999', () => {
		expect(formatCertificateNumber(2026, 7)).toBe('APU-2026-0007');
		expect(formatCertificateNumber(2026, 1234)).toBe('APU-2026-1234');
		expect(formatCertificateNumber(2026, 12345)).toBe('APU-2026-12345');
	});

	it('the year of the issue date in Yerevan (UTC+4)', () => {
		expect(certificateYear(new Date('2026-12-31T19:59:00Z'))).toBe(2026);
		expect(certificateYear(new Date('2026-12-31T20:00:00Z'))).toBe(2027);
	});

	it('public token: 32 url-safe characters, never the same', () => {
		const a = newPublicToken();
		expect(a).toMatch(/^[A-Za-z0-9_-]{32}$/);
		expect(newPublicToken()).not.toBe(a);
	});
});

describe.skipIf(!testDbUrl)('certificates: next number', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('the first of a year is 0001', async () => {
		await inRollback(async (tx) => {
			expect(await nextCertificateNumber(tx, new Date('2098-06-01T12:00:00Z'))).toBe(
				'APU-2098-0001'
			);
		});
	});

	it('the year maximum + 1: other years, other formats and revoked numbers count right', async () => {
		await inRollback(async (tx) => {
			const admin = await insertStaff(tx, 'admin');
			const base = { userId: admin.id, issuedBy: admin.id, kind: 'trainer' as const };
			await insertCertificate(tx, { ...base, number: 'APU-2099-0009' });
			await insertCertificate(tx, {
				...base,
				number: 'APU-2099-0041',
				status: 'revoked',
				revokedAt: new Date(),
				revokeReason: 'Mistake'
			});
			await insertCertificate(tx, { ...base, number: 'APU-2097-0500' });
			await insertCertificate(tx, { ...base, number: 'APU-2099-X' });
			await insertCertificate(tx, { ...base, number: 'OLD-2099-9999' });

			expect(await nextCertificateNumber(tx, new Date('2099-03-01T12:00:00Z'))).toBe(
				'APU-2099-0042'
			);
			await insertCertificate(tx, { ...base, number: 'APU-2099-10000' });
			expect(await nextCertificateNumber(tx, new Date('2099-03-01T12:00:00Z'))).toBe(
				'APU-2099-10001'
			);
		});
	});
});
