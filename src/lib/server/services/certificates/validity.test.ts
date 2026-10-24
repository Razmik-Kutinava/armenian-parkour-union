import { describe, expect, it } from 'vitest';
import { certificateState, staffExpiry } from './validity';

/* docs/03 section 4.6–4.7: level certificates never expire; coach and judge ones end on
 * `expires_at`, before the daily job (6.9) writes `expired`; a revoked one is revoked whatever else. */

const NOW = new Date('2026-10-24T12:00:00Z');
const at = (iso: string) => new Date(iso);

describe('certificates: state', () => {
	it('active without an end date or before it', () => {
		expect(certificateState({ status: 'active', expiresAt: null }, NOW)).toBe('active');
		expect(certificateState({ status: 'active', expiresAt: at('2026-10-25T00:00:00Z') }, NOW)).toBe(
			'active'
		);
	});

	it('expired by status or by the date, even before the daily job', () => {
		expect(certificateState({ status: 'expired', expiresAt: null }, NOW)).toBe('expired');
		expect(certificateState({ status: 'active', expiresAt: NOW }, NOW)).toBe('expired');
		expect(certificateState({ status: 'active', expiresAt: at('2025-01-01T00:00:00Z') }, NOW)).toBe(
			'expired'
		);
	});

	it('revoked stays revoked, with or without an end date', () => {
		expect(certificateState({ status: 'revoked', expiresAt: null }, NOW)).toBe('revoked');
		expect(certificateState({ status: 'revoked', expiresAt: at('2020-01-01T00:00:00Z') }, NOW)).toBe(
			'revoked'
		);
	});
});

describe('certificates: coach and judge end date', () => {
	it('adds whole months', () => {
		expect(staffExpiry(at('2026-10-24T09:30:00Z'), 24)).toEqual(at('2028-10-24T09:30:00Z'));
		expect(staffExpiry(at('2026-01-15T00:00:00Z'), 1)).toEqual(at('2026-02-15T00:00:00Z'));
	});

	it('a day the target month lacks becomes its last day, not the next month', () => {
		expect(staffExpiry(at('2026-01-31T10:00:00Z'), 1)).toEqual(at('2026-02-28T10:00:00Z'));
		expect(staffExpiry(at('2028-02-29T10:00:00Z'), 24)).toEqual(at('2030-02-28T10:00:00Z'));
	});
});
