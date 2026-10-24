import { describe, expect, it } from 'vitest';
import { CERTIFICATE_DEFAULTS, parseCertificateSettings } from './settings';

/* docs/03 section 4.6, 16: coach and judge certificates are valid 2 years unless the owner sets
 * `site_settings.certificates.staff_valid_months`; docs/08 section 10: Russian in the PDF — by
 * `pdf_russian` (on by default, questions.md stage 6). */

describe('certificates: settings', () => {
	it('defaults: 24 months, Russian in the PDF', () => {
		expect(CERTIFICATE_DEFAULTS).toEqual({ staffValidMonths: 24, pdfRussian: true });
	});

	it('reads the stored snake_case value', () => {
		expect(parseCertificateSettings({ staff_valid_months: 36, pdf_russian: false })).toEqual({
			staffValidMonths: 36,
			pdfRussian: false
		});
		expect(parseCertificateSettings({ staff_valid_months: 1 })).toEqual({
			staffValidMonths: 1,
			pdfRussian: true
		});
	});

	it('each broken field falls back on its own', () => {
		expect(parseCertificateSettings({ staff_valid_months: 0, pdf_russian: false })).toEqual({
			staffValidMonths: 24,
			pdfRussian: false
		});
		expect(parseCertificateSettings({ staff_valid_months: 12, pdf_russian: 'no' })).toEqual({
			staffValidMonths: 12,
			pdfRussian: true
		});
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
