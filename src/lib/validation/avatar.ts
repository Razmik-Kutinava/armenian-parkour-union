import { z } from 'zod';
import { mediaTypes } from './media';

/* Profile photo (docs/06 section 5.2), decisions.md 2026-10-22: not a media library file. */

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const avatarMimes = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AvatarMime = (typeof avatarMimes)[number];

export const isAvatarMime = (mime: string): mime is AvatarMime =>
	(avatarMimes as readonly string[]).includes(mime);

export const avatarRequestSchema = z.object({
	mime: z.enum(avatarMimes, { error: 'cabinet.avatar.type' }),
	size: z.coerce
		.number()
		.int()
		.min(1, { error: 'cabinet.avatar.empty' })
		.max(AVATAR_MAX_BYTES, { error: 'cabinet.avatar.size' })
});
export type AvatarRequest = z.output<typeof avatarRequestSchema>;

/** `avatars/<user id>/<uuid>.<ext>`: the owner is part of the key, the name never comes from the user. */
export const avatarKey = (userId: string, mime: AvatarMime) =>
	`avatars/${userId}/${crypto.randomUUID()}.${mediaTypes[mime]}`;

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const KEY = new RegExp(`^avatars/(${UUID})/${UUID}\\.(\\w+)$`);

/** The type of an avatar key of this user; `null` for anyone else's or any other key. */
export function avatarMimeOfKey(userId: string, key: string): AvatarMime | null {
	const match = KEY.exec(key);
	if (!match || match[1] !== userId) return null;
	return avatarMimes.find((m) => mediaTypes[m] === match[2]) ?? null;
}
