import { describe, expect, it } from 'vitest';
import { CERTIFICATE_DEFAULTS, parseCertificateSettings } from './settings';

/* docs/03 section 4.6, 16: coach and judge certificates are valid 2 years unless the owner sets
 * `site_settings.certificates.staff_valid_months`. */

describe('certificates: settings', () => {
	it('defaults: 24 months', () => {
		expect(CERTIFICATE_DEFAULTS).toEqual({ staffValidMonths: 24 });
	});

	it('reads the stored snake_case value', () => {
		expect(parseCertificateSettings({ staff_valid_months: 36 })).toEqual({ staffValidMonths: 36 });
		expect(parseCertificateSettings({ staff_valid_months: 1 })).toEqual({ staffValidMonths: 1 });
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
