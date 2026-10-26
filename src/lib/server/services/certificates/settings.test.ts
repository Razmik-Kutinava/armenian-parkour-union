import { describe, expect, it } from 'vitest';
import { CERTIFICATE_DEFAULTS, parseCertificateSettings } from './settings';

/* docs/03 section 4.6, 16: coach and judge certificates are valid 2 years unless the owner sets
 * `site_settings.certificates.staff_valid_months`; docs/08 section 10: Russian in the PDF — by
 * `pdf_russian` (on by default, questions.md stage 6); letters before the end — 30 and 7 days
 * by `staff_remind_days` (questions.md stage 6, 6.9); the signer under the line — `signer`
 * (questions.md stage 6, 2026-10-26), none — the plain "Signature". */

const REMIND = [30, 7];
const SIGNER = {
	name: { en: 'Razmik Giurdzian', hy: 'Ռազմիկ Գյուրջյան' },
	title: { en: 'Head of the Federation' }
};

describe('certificates: settings', () => {
	it('defaults: 24 months, Russian in the PDF, letters 30 and 7 days ahead, no signer', () => {
		expect(CERTIFICATE_DEFAULTS).toEqual({
			staffValidMonths: 24,
			pdfRussian: true,
			staffRemindDays: REMIND,
			signer: null
		});
	});

	it('reads the stored snake_case value', () => {
		expect(
			parseCertificateSettings({
				staff_valid_months: 36,
				pdf_russian: false,
				staff_remind_days: [60, 14, 1],
				signer: SIGNER
			})
		).toEqual({
			staffValidMonths: 36,
			pdfRussian: false,
			staffRemindDays: [60, 14, 1],
			signer: SIGNER
		});
		expect(parseCertificateSettings({ staff_valid_months: 1 })).toEqual({
			staffValidMonths: 1,
			pdfRussian: true,
			staffRemindDays: REMIND,
			signer: null
		});
	});

	it('each broken field falls back on its own', () => {
		expect(parseCertificateSettings({ staff_valid_months: 0, pdf_russian: false })).toEqual({
			staffValidMonths: 24,
			pdfRussian: false,
			staffRemindDays: REMIND,
			signer: null
		});
		expect(parseCertificateSettings({ staff_valid_months: 12, pdf_russian: 'no' })).toEqual({
			staffValidMonths: 12,
			pdfRussian: true,
			staffRemindDays: REMIND,
			signer: null
		});
	});

	it('reminder days: whole days 1–365, at most 10 of them; anything else — the default', () => {
		for (const days of [[], [0], [-7], [7.5], ['30'], [366], 30, null, Array(11).fill(1)]) {
			const parsed = parseCertificateSettings({ staff_valid_months: 12, staff_remind_days: days });
			expect(parsed.staffRemindDays, JSON.stringify(days)).toEqual(REMIND);
		}
		expect(parseCertificateSettings({ staff_remind_days: [365, 1] }).staffRemindDays).toEqual([
			365, 1
		]);
	});

	it('signer: a name and a title, English required; anything else — none', () => {
		for (const signer of [
			null,
			'Razmik',
			{ name: { en: 'Razmik Giurdzian' } },
			{ name: { hy: 'Ռազմիկ' }, title: { hy: 'ղեկավար' } },
			{ name: { en: '' }, title: { en: 'Head' } },
			{ name: { en: 'Razmik' }, title: { en: 7 } }
		]) {
			expect(parseCertificateSettings({ signer }).signer, JSON.stringify(signer)).toBeNull();
		}
		expect(parseCertificateSettings({ signer: SIGNER, pdf_russian: 'x' }).signer).toEqual(SIGNER);
	});

	it('missing or broken — the defaults', () => {
		for (const value of [
			undefined,
			null,
			[],
			'24',
			{},
			{ staff_valid_months: 0 },
			{ staff_valid_months: -12 },
			{ staff_valid_months: 1.5 },
			{ staff_valid_months: '24' },
			{ staff_valid_months: 1201 }
		]) {
			expect(parseCertificateSettings(value), JSON.stringify(value)).toEqual(CERTIFICATE_DEFAULTS);
		}
	});
});
