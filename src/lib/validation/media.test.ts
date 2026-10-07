import { describe, expect, it } from 'vitest';
import {
	MEDIA_MAX_BYTES,
	altSchema,
	mediaKey,
	mimeOfKey,
	sniffMime,
	uploadRequestSchema
} from './media';

const bytes = (...values: (number | string)[]) =>
	new Uint8Array(
		values.flatMap((v) => (typeof v === 'string' ? [...v].map((c) => c.charCodeAt(0)) : [v]))
	);

describe('media file rules (docs/05 section 20, decisions 2026-10-07)', () => {
	it('accepts JPEG, PNG, WebP, AVIF and PDF from 1 byte to 10 MB', () => {
		for (const mime of ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'application/pdf']) {
			expect(uploadRequestSchema.safeParse({ name: 'a', mime, size: '1' }).success, mime).toBe(
				true
			);
		}
		const ok = { name: 'photo.jpg', mime: 'image/jpeg' };
		expect(uploadRequestSchema.safeParse({ ...ok, size: MEDIA_MAX_BYTES }).success).toBe(true);
		expect(uploadRequestSchema.safeParse({ ...ok, size: MEDIA_MAX_BYTES + 1 }).success).toBe(false);
		expect(uploadRequestSchema.safeParse({ ...ok, size: 0 }).success).toBe(false);
	});

	it('refuses SVG, HTML and anything else', () => {
		for (const mime of ['image/svg+xml', 'text/html', 'application/octet-stream', '']) {
			expect(uploadRequestSchema.safeParse({ name: 'a', mime, size: 10 }).success, mime).toBe(
				false
			);
		}
	});

	it('keeps only the base name, without paths or control characters', () => {
		const parsed = uploadRequestSchema.parse({
			name: '../../etc\\pass\u0000wd.png',
			mime: 'image/png',
			size: 5
		});
		expect(parsed.name).toBe('....etcpasswd.png');
		expect(uploadRequestSchema.safeParse({ name: ' / ', mime: 'image/png', size: 5 }).success).toBe(
			false
		);
	});

	it('detects the real type by the first bytes of the file', () => {
		expect(sniffMime(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
		expect(sniffMime(bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png');
		expect(sniffMime(bytes('RIFF', 0, 0, 0, 0, 'WEBPVP8 '))).toBe('image/webp');
		expect(sniffMime(bytes(0, 0, 0, 0x1c, 'ftypavif'))).toBe('image/avif');
		expect(sniffMime(bytes('%PDF-1.7'))).toBe('application/pdf');
		expect(sniffMime(bytes('<html><script>'))).toBeNull();
		expect(sniffMime(bytes('<svg xmlns='))).toBeNull();
		expect(sniffMime(bytes())).toBeNull();
	});

	it('builds keys of one format and reads the type back only from such keys', () => {
		const key = mediaKey('image/webp', new Date('2026-10-07T12:00:00Z'));
		expect(key).toMatch(/^media\/2026\/10\/[0-9a-f-]{36}\.webp$/);
		expect(mimeOfKey(key)).toBe('image/webp');
		expect(mimeOfKey('media/2026/10/not-a-uuid.webp')).toBeNull();
		expect(mimeOfKey('other/2026/10/' + crypto.randomUUID() + '.png')).toBeNull();
		expect(mimeOfKey(`media/2026/10/${crypto.randomUUID()}.svg`)).toBeNull();
	});

	it('alt text: optional per language, blank languages dropped, all blank → null', () => {
		expect(altSchema.parse({ en: ' Jump ', hy: '', ru: 'Прыжок' })).toEqual({
			en: 'Jump',
			ru: 'Прыжок'
		});
		expect(altSchema.parse({ en: '', hy: ' ' })).toBeNull();
		expect(altSchema.safeParse({ en: 'x'.repeat(301) }).success).toBe(false);
	});
});
