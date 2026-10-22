import { and, eq, isNull } from 'drizzle-orm';
import { SNIFF_BYTES, sniffMime } from '#lib/validation/media.ts';
import {
	AVATAR_MAX_BYTES,
	avatarKey,
	avatarMimeOfKey,
	type AvatarRequest
} from '#lib/validation/avatar.ts';
import { consume, limits, type LimitDb } from '../../auth/rate-limit';
import { users } from '../../db/schema/users';
import type { Storage } from '../../storage/types';
import { isUuid } from '../users/target';

/* docs/06 section 5.2 "photo", decisions.md 2026-10-22: signed link → PUT to the bucket → the
 * server checks the object itself, as the media library does (docs/05 section 20). */

export type AvatarSignResult = { key: string; url: string } | 'limited' | 'not_found';
export type AvatarCompleteResult =
	'ok' | 'not_found' | 'bad_key' | 'missing' | 'too_large' | 'bad_type';

async function exists(db: LimitDb, userId: string) {
	if (!isUuid(userId)) return false;
	const [row] = await db
		.select({ id: users.id })
		.from(users)
		.where(and(eq(users.id, userId), isNull(users.deletedAt)));
	return Boolean(row);
}

export async function signAvatarUpload(
	db: LimitDb,
	storage: Storage,
	userId: string,
	req: AvatarRequest
): Promise<AvatarSignResult> {
	if (!(await exists(db, userId))) return 'not_found';
	if (!(await consume(db, `avatar-upload:user:${userId}`, limits.avatarUploadPerUser))) {
		return 'limited';
	}
	const key = avatarKey(userId, req.mime);
	return { key, url: await storage.presignPut(key, req.mime, req.size) };
}

/** Sets the avatar under the row lock; returns the key it replaced. */
async function swap(db: LimitDb, userId: string, key: string | null) {
	return db.transaction(async (tx) => {
		const [row] = await tx
			.select({ old: users.avatarKey })
			.from(users)
			.where(and(eq(users.id, userId), isNull(users.deletedAt)))
			.for('update');
		if (!row) return undefined;
		await tx.update(users).set({ avatarKey: key }).where(eq(users.id, userId));
		return row.old;
	});
}

/** Only the member's own uploads are removed from the bucket, never a library file. */
async function drop(storage: Storage, userId: string, old: string | null, kept: string | null) {
	if (!old || old === kept || !avatarMimeOfKey(userId, old)) return;
	await storage.remove(old).catch((e) => console.warn(`avatar ${old}: not removed`, e));
}

export async function completeAvatarUpload(
	db: LimitDb,
	storage: Storage,
	userId: string,
	key: string
): Promise<AvatarCompleteResult> {
	if (!(await exists(db, userId))) return 'not_found';
	const expected = avatarMimeOfKey(userId, key);
	if (!expected) return 'bad_key';
	const head = await storage.head(key);
	if (!head) return 'missing';
	const refuse = async (reason: 'too_large' | 'bad_type') => {
		await storage.remove(key);
		return reason;
	};
	if (head.size > AVATAR_MAX_BYTES) return refuse('too_large');
	if (head.size < 1) return refuse('bad_type');
	if (sniffMime(await storage.readStart(key, SNIFF_BYTES)) !== expected) return refuse('bad_type');

	const old = await swap(db, userId, key);
	if (old === undefined) return 'not_found';
	await drop(storage, userId, old, key);
	return 'ok';
}

export async function removeAvatar(
	db: LimitDb,
	storage: Storage,
	userId: string
): Promise<'ok' | 'not_found'> {
	if (!isUuid(userId)) return 'not_found';
	const old = await swap(db, userId, null);
	if (old === undefined) return 'not_found';
	await drop(storage, userId, old, null);
	return 'ok';
}
