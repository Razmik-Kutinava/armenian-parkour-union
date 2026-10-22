import { describe, expect, it } from 'vitest';
import {
	approveSchema,
	CONSENT_MAX_BYTES,
	consentCompleteSchema,
	consentKey,
	consentMimeOfKey,
	consentSignSchema,
	endOfYerevanDay,
	rejectSchema
} from './consents';

/* docs/05 section 10, docs/06 section 5.10; types and size — decisions.md 2026-10-22 (5.2). */

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const NOW = new Date('2026-10-22T10:00:00Z');

describe('consent files', () => {
	it('the key is under the member`s own folder, the name never comes from the user', () => {
		const key = consentKey(USER, 'application/pdf');
		expect(key).toMatch(new RegExp(`^consents/${USER}/[0-9a-f-]{36}\\.pdf$`));
		expect(consentMimeOfKey(USER, key)).toBe('application/pdf');
		expect(consentMimeOfKey(USER, consentKey(USER, 'image/webp'))).toBe('image/webp');
	});

	it('another member`s key, an avatar or a library key is not a consent of this member', () => {
		expect(consentMimeOfKey(USER, consentKey(OTHER, 'image/png'))).toBeNull();
		expect(consentMimeOfKey(USER, `avatars/${USER}/${crypto.randomUUID()}.png`)).toBeNull();
		expect(consentMimeOfKey(USER, `media/2026/10/${crypto.randomUUID()}.pdf`)).toBeNull();
		expect(consentMimeOfKey(USER, `consents/${USER}/../${crypto.randomUUID()}.png`)).toBeNull();
		expect(consentMimeOfKey(USER, `consents/${USER}/${crypto.randomUUID()}.avif`)).toBeNull();
	});

	it('JPEG, PNG, WebP and PDF up to 10 MB; no AVIF, SVG or empty file', () => {
		const ok = { kind: 'parental', mime: 'application/pdf', size: String(CONSENT_MAX_BYTES) };
		expect(consentSignSchema.safeParse(ok).success).toBe(true);
		for (const mime of ['image/jpeg', 'image/png', 'image/webp']) {
			expect(consentSignSchema.safeParse({ ...ok, mime }).success).toBe(true);
		}
		for (const bad of [
			{ mime: 'image/avif' },
			{ mime: 'image/svg+xml' },
			{ size: '0' },
			{ size: String(CONSENT_MAX_BYTES + 1) },
			{ kind: 'other' }
		]) {
			expect(consentSignSchema.safeParse({ ...ok, ...bad }).success).toBe(false);
		}
	});

	it('the signing day is a real day, not in the future (Yerevan)', () => {
		const schema = consentCompleteSchema(NOW);
		const base = { kind: 'medical', key: consentKey(USER, 'image/png') };
		expect(schema.safeParse({ ...base, signedOn: '2026-10-22' }).success).toBe(true);
		expect(schema.safeParse({ ...base, signedOn: '2025-01-31' }).success).toBe(true);
		for (const signedOn of ['2026-10-23', '2026-02-30', '22.10.2026', '']) {
			expect(schema.safeParse({ ...base, signedOn }).success).toBe(false);
		}
	});
});

describe('consent review forms', () => {
	it('"valid until" is optional, today or later, the end of that day in Yerevan', () => {
		const schema = approveSchema(NOW);
		expect(schema.parse({ validUntil: '' })).toEqual({ validUntil: null });
		expect(schema.parse({})).toEqual({ validUntil: null });
		expect(schema.parse({ validUntil: '2026-10-22' })).toEqual({
			validUntil: endOfYerevanDay('2026-10-22')
		});
		expect(schema.safeParse({ validUntil: '2026-10-21' }).success).toBe(false);
		expect(schema.safeParse({ validUntil: '2026-13-01' }).success).toBe(false);
		expect(endOfYerevanDay('2026-10-22').toISOString()).toBe('2026-10-22T19:59:59.999Z');
	});

	it('a refusal needs a reason up to 500 characters', () => {
		expect(rejectSchema.parse({ note: '  Unreadable scan  ' })).toEqual({ note: 'Unreadable scan' });
		expect(rejectSchema.safeParse({ note: '   ' }).success).toBe(false);
		expect(rejectSchema.safeParse({ note: 'x'.repeat(501) }).success).toBe(false);
	});
});
