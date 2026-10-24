import { describe, expect, it } from 'vitest';
import { CERTIFICATE_DEFAULTS, parseCertificateSettings } from './settings';

/* docs/03 section 4.6, 16: coach and judge certificates are valid 2 years unless the owner sets
 * `site_settings.certificates.staff_valid_months`; docs/08 section 10: Russian in the PDF — by
 * `pdf_russian` (on by default, questions.md stage 6); letters before the end — 30 and 7 days
 * by `staff_remind_days` (questions.md stage 6, 6.9). */

const REMIND = [30, 7];

describe('certificates: settings', () => {
	it('defaults: 24 months, Russian in the PDF, letters 30 and 7 days ahead', () => {
		expect(CERTIFICATE_DEFAULTS).toEqual({
			staffValidMonths: 24,
			pdfRussian: true,
			staffRemindDays: REMIND
		});
	});

	it('reads the stored snake_case value', () => {
		expect(
			parseCertificateSettings({
				staff_valid_months: 36,
				pdf_russian: false,
				staff_remind_days: [60, 14, 1]
			})
		).toEqual({ staffValidMonths: 36, pdfRussian: false, staffRemindDays: [60, 14, 1] });
		expect(parseCertificateSettings({ staff_valid_months: 1 })).toEqual({
			staffValidMonths: 1,
			pdfRussian: true,
			staffRemindDays: REMIND
		});
	});

	it('each broken field falls back on its own', () => {
		expect(parseCertificateSettings({ staff_valid_months: 0, pdf_russian: false })).toEqual({
			staffValidMonths: 24,
			pdfRussian: false,
			staffRemindDays: REMIND
		});
		expect(parseCertificateSettings({ staff_valid_months: 12, pdf_russian: 'no' })).toEqual({
			staffValidMonths: 12,
			pdfRussian: true,
			staffRemindDays: REMIND
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
