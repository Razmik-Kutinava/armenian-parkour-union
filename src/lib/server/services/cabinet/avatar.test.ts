import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { AVATAR_MAX_BYTES } from '#lib/validation/avatar.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { media } from '../../db/schema/service';
import { users } from '../../db/schema/users';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { fakeStorage } from '../media/fake-storage';
import { completeAvatarUpload, removeAvatar, signAvatarUpload } from './avatar';

/* docs/06 section 5.2 "photo"; rules — decisions.md 2026-10-22. */

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const AVIF = new Uint8Array([0, 0, 0, 0x1c, ...new TextEncoder().encode('ftypavif'), 0, 0, 0, 0]);
const HTML = new TextEncoder().encode('<html><script>alert(1)</script></html>');
const png = { mime: 'image/png' as const, size: PNG.length };

const avatarOf = async (tx: LimitDb, id: string) =>
	(await tx.select({ key: users.avatarKey }).from(users).where(eq(users.id, id)))[0].key;

async function signed(tx: LimitDb, storage: ReturnType<typeof fakeStorage>, userId: string) {
	const result = await signAvatarUpload(tx, storage, userId, png);
	if (typeof result === 'string') throw new Error(result);
	return result;
}

describe.skipIf(!testDbUrl)('cabinet: profile photo', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('signs a direct upload under the member`s own folder', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx);
			const { key, url } = await signed(tx, fakeStorage(), user.id);
			expect(key).toMatch(new RegExp(`^avatars/${user.id}/[0-9a-f-]{36}\\.png$`));
			expect(url).toContain(key);
		});
	});

	it('10 upload links an hour per member, then "limited"', async () => {
		await inRollback(async (tx) => {
			const storage = fakeStorage();
			const user = await insertUser(tx);
			const other = await insertUser(tx);
			for (let i = 0; i < 10; i++) await signed(tx, storage, user.id);
			expect(await signAvatarUpload(tx, storage, user.id, png)).toBe('limited');
			await signed(tx, storage, other.id);
		});
	});

	it('a deleted or unknown member gets nothing', async () => {
		await inRollback(async (tx) => {
			const storage = fakeStorage();
			const gone = await insertUser(tx, { deletedAt: new Date() });
			expect(await signAvatarUpload(tx, storage, gone.id, png)).toBe('not_found');
			expect(await signAvatarUpload(tx, storage, 'not-a-uuid', png)).toBe('not_found');
			const key = `avatars/${gone.id}/${crypto.randomUUID()}.png`;
			storage.objects.set(key, PNG);
			expect(await completeAvatarUpload(tx, storage, gone.id, key)).toBe('not_found');
			expect(await removeAvatar(tx, storage, gone.id)).toBe('not_found');
		});
	});

	it('complete: the checked file becomes the avatar; no media library row', async () => {
		await inRollback(async (tx) => {
			const storage = fakeStorage();
			const user = await insertUser(tx);
			const { key } = await signed(tx, storage, user.id);
			storage.objects.set(key, PNG);
			expect(await completeAvatarUpload(tx, storage, user.id, key)).toBe('ok');
			expect(await avatarOf(tx, user.id)).toBe(key);
			expect(await tx.select().from(media).where(eq(media.key, key))).toHaveLength(0);
			expect(storage.objects.has(key)).toBe(true);
		});
	});

	it('another member`s key or a library key cannot be claimed', async () => {
		await inRollback(async (tx) => {
			const storage = fakeStorage();
			const user = await insertUser(tx);
			const victim = await insertUser(tx);
			const theirs = (await signed(tx, storage, victim.id)).key;
			const library = `media/2026/10/${crypto.randomUUID()}.png`;
			for (const key of [theirs, library]) {
				storage.objects.set(key, PNG);
				expect(await completeAvatarUpload(tx, storage, user.id, key)).toBe('bad_key');
				expect(storage.objects.has(key)).toBe(true);
			}
			expect(await avatarOf(tx, user.id)).toBeNull();
		});
	});

	it('not uploaded — "missing"; too large or not the declared image — removed', async () => {
		await inRollback(async (tx) => {
			const storage = fakeStorage();
			const user = await insertUser(tx);
			const { key } = await signed(tx, storage, user.id);
			expect(await completeAvatarUpload(tx, storage, user.id, key)).toBe('missing');

			const big = new Uint8Array(AVATAR_MAX_BYTES + 1);
			big.set(PNG);
			const cases = [
				[big, 'too_large'],
				[new Uint8Array(), 'bad_type'],
				[HTML, 'bad_type'],
				[JPEG, 'bad_type'],
				[AVIF, 'bad_type']
			] as const;
			for (const [body, reason] of cases) {
				storage.objects.set(key, body);
				expect(await completeAvatarUpload(tx, storage, user.id, key)).toBe(reason);
				expect(storage.objects.has(key)).toBe(false);
			}
			expect(await avatarOf(tx, user.id)).toBeNull();
		});
	});

	it('a new photo replaces the old one, the old object is removed', async () => {
		await inRollback(async (tx) => {
			const storage = fakeStorage();
			const user = await insertUser(tx);
			const first = (await signed(tx, storage, user.id)).key;
			storage.objects.set(first, PNG);
			await completeAvatarUpload(tx, storage, user.id, first);
			const second = (await signed(tx, storage, user.id)).key;
			storage.objects.set(second, PNG);
			expect(await completeAvatarUpload(tx, storage, user.id, second)).toBe('ok');
			expect(await avatarOf(tx, user.id)).toBe(second);
			expect(storage.objects.has(first)).toBe(false);
			expect(storage.objects.has(second)).toBe(true);
			expect(await completeAvatarUpload(tx, storage, user.id, second)).toBe('ok');
			expect(storage.objects.has(second)).toBe(true);
		});
	});

	it('a library file set as the avatar by staff is not removed from the bucket', async () => {
		await inRollback(async (tx) => {
			const storage = fakeStorage();
			const library = `media/2026/10/${crypto.randomUUID()}.png`;
			storage.objects.set(library, PNG);
			const user = await insertUser(tx, { avatarKey: library });
			const { key } = await signed(tx, storage, user.id);
			storage.objects.set(key, PNG);
			await completeAvatarUpload(tx, storage, user.id, key);
			expect(storage.objects.has(library)).toBe(true);
			expect(await removeAvatar(tx, storage, user.id)).toBe('ok');
			expect(storage.objects.has(key)).toBe(false);

			await tx.update(users).set({ avatarKey: library }).where(eq(users.id, user.id));
			expect(await removeAvatar(tx, storage, user.id)).toBe('ok');
			expect(await avatarOf(tx, user.id)).toBeNull();
			expect(storage.objects.has(library)).toBe(true);
		});
	});

	it('removing the photo clears it; a bucket failure does not undo that', async () => {
		await inRollback(async (tx) => {
			const storage = fakeStorage();
			const user = await insertUser(tx);
			const { key } = await signed(tx, storage, user.id);
			storage.objects.set(key, PNG);
			await completeAvatarUpload(tx, storage, user.id, key);
			storage.remove = async () => {
				throw new Error('R2 is down');
			};
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
			expect(await removeAvatar(tx, storage, user.id)).toBe('ok');
			expect(warn).toHaveBeenCalled();
			warn.mockRestore();
			expect(await avatarOf(tx, user.id)).toBeNull();
			expect(await removeAvatar(tx, storage, user.id)).toBe('ok');
		});
	});
});
