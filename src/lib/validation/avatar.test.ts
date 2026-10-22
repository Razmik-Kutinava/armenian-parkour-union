import { describe, expect, it } from 'vitest';
import { AVATAR_MAX_BYTES, avatarKey, avatarMimeOfKey, avatarRequestSchema } from './avatar';

/* decisions.md 2026-10-22: JPEG / PNG / WebP up to 5 MB under `avatars/<user id>/`. */

const ME = '11111111-2222-4333-8444-555555555555';
const OTHER = '99999999-2222-4333-8444-555555555555';

describe('avatar upload rules', () => {
	it('accepts JPEG, PNG and WebP from 1 byte to 5 MB', () => {
		for (const mime of ['image/jpeg', 'image/png', 'image/webp']) {
			expect(avatarRequestSchema.safeParse({ mime, size: '1' }).success).toBe(true);
			expect(avatarRequestSchema.safeParse({ mime, size: AVATAR_MAX_BYTES }).success).toBe(true);
		}
	});

	it('refuses other types, an empty file and more than 5 MB', () => {
		const message = (input: object) =>
			avatarRequestSchema.safeParse(input).error?.issues[0].message;
		expect(message({ mime: 'image/avif', size: 10 })).toBe('cabinet.avatar.type');
		expect(message({ mime: 'application/pdf', size: 10 })).toBe('cabinet.avatar.type');
		expect(message({ mime: 'image/svg+xml', size: 10 })).toBe('cabinet.avatar.type');
		expect(message({ mime: 'image/png', size: 0 })).toBe('cabinet.avatar.empty');
		expect(message({ mime: 'image/png', size: AVATAR_MAX_BYTES + 1 })).toBe('cabinet.avatar.size');
	});

	it('a key is under the owner, with a fresh name and the type extension', () => {
		const key = avatarKey(ME, 'image/webp');
		expect(key).toMatch(new RegExp(`^avatars/${ME}/[0-9a-f-]{36}\\.webp$`));
		expect(avatarKey(ME, 'image/webp')).not.toBe(key);
		expect(avatarMimeOfKey(ME, key)).toBe('image/webp');
		expect(avatarMimeOfKey(ME, avatarKey(ME, 'image/jpeg'))).toBe('image/jpeg');
	});

	it('somebody else`s, library or crafted keys are not the owner`s avatar', () => {
		const name = `${crypto.randomUUID()}.png`;
		expect(avatarMimeOfKey(ME, `avatars/${OTHER}/${name}`)).toBeNull();
		expect(avatarMimeOfKey(ME, `media/2026/10/${name}`)).toBeNull();
		expect(avatarMimeOfKey(ME, `avatars/${ME}/../${OTHER}/${name}`)).toBeNull();
		expect(avatarMimeOfKey(ME, `avatars/${ME}/${crypto.randomUUID()}.pdf`)).toBeNull();
		expect(avatarMimeOfKey(ME, `avatars/${ME}/${crypto.randomUUID()}.avif`)).toBeNull();
		expect(avatarMimeOfKey(ME, `avatars/${ME}/evil.png`)).toBeNull();
	});
});
