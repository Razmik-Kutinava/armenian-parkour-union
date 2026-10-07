import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { MEDIA_MAX_BYTES } from '#lib/validation/media.ts';
import type { LimitDb } from '../../auth/rate-limit';
import type { UserRole } from '../../auth/session';
import { auditLog, media } from '../../db/schema/service';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { fakeStorage } from './fake-storage';
import { completeUpload, signUpload } from './upload';

const IP = '198.51.100.7';
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
const HTML = new TextEncoder().encode('<html><script>alert(1)</script></html>');
const request = { name: 'jump.png', mime: 'image/png' as const, size: PNG.length };

describe.skipIf(!testDbUrl)('upload to the media library (docs/05 section 20)', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	const staff = async (tx: LimitDb, role: UserRole = 'editor') => ({
		id: (await insertUser(tx, { role })).id,
		role
	});
	const auditOf = (tx: LimitDb, id: string) =>
		tx.select().from(auditLog).where(eq(auditLog.entityId, id));

	it('signs a direct upload link with a fresh key of the declared type', async () => {
		const storage = fakeStorage();
		const signed = await signUpload(storage, { id: crypto.randomUUID(), role: 'editor' }, request);
		if (typeof signed === 'string') throw new Error(signed);
		expect(signed.key).toMatch(/^media\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.png$/);
		expect(signed.url).toContain(signed.key);
	});

	it('moderator and member get no upload link', async () => {
		const storage = fakeStorage();
		for (const role of ['moderator', 'member'] as const) {
			expect(await signUpload(storage, { id: crypto.randomUUID(), role }, request)).toBe(
				'not_allowed'
			);
		}
	});

	it('complete: the uploaded file enters the library with its real type, logged', async () => {
		await inRollback(async (tx) => {
			const storage = fakeStorage();
			const actor = await staff(tx);
			const signed = await signUpload(storage, actor, request);
			if (typeof signed === 'string') throw new Error(signed);
			storage.objects.set(signed.key, PNG);

			const result = await completeUpload(
				tx,
				storage,
				actor,
				{ key: signed.key, name: 'jump.png' },
				IP
			);
			if (typeof result === 'string') throw new Error(result);
			const [row] = await tx.select().from(media).where(eq(media.id, result.id));
			expect(row).toMatchObject({
				key: signed.key,
				originalName: 'jump.png',
				mime: 'image/png',
				sizeBytes: PNG.length,
				uploadedBy: actor.id,
				deletedAt: null
			});
			const [entry] = await auditOf(tx, result.id);
			expect(entry).toMatchObject({
				action: 'media.upload',
				entityType: 'media',
				actorId: actor.id,
				ip: IP
			});
		});
	});

	it('a file whose content is not its type is refused and removed from the bucket', async () => {
		await inRollback(async (tx) => {
			const storage = fakeStorage();
			const actor = await staff(tx);
			const signed = await signUpload(storage, actor, request);
			if (typeof signed === 'string') throw new Error(signed);
			storage.objects.set(signed.key, HTML);

			expect(await completeUpload(tx, storage, actor, { key: signed.key, name: 'x.png' }, IP)).toBe(
				'bad_type'
			);
			expect(storage.objects.has(signed.key)).toBe(false);
			expect(await tx.select().from(media).where(eq(media.key, signed.key))).toHaveLength(0);
		});
	});

	it('a file over 10 MB is refused and removed', async () => {
		await inRollback(async (tx) => {
			const storage = fakeStorage();
			const actor = await staff(tx);
			const signed = await signUpload(storage, actor, request);
			if (typeof signed === 'string') throw new Error(signed);
			const big = new Uint8Array(MEDIA_MAX_BYTES + 1);
			big.set(PNG);
			storage.objects.set(signed.key, big);

			expect(
				await completeUpload(tx, storage, actor, { key: signed.key, name: 'big.png' }, IP)
			).toBe('too_large');
			expect(storage.objects.has(signed.key)).toBe(false);
		});
	});

	it('foreign or missing keys and repeated completes add nothing', async () => {
		await inRollback(async (tx) => {
			const storage = fakeStorage();
			const actor = await staff(tx);
			const name = 'a.png';
			for (const key of [
				'avatars/x.png',
				`media/2026/10/${crypto.randomUUID()}.svg`,
				'../media.png'
			]) {
				expect(await completeUpload(tx, storage, actor, { key, name }, IP), key).toBe('bad_key');
			}
			const absent = `media/2026/10/${crypto.randomUUID()}.png`;
			expect(await completeUpload(tx, storage, actor, { key: absent, name }, IP)).toBe('missing');

			const signed = await signUpload(storage, actor, request);
			if (typeof signed === 'string') throw new Error(signed);
			storage.objects.set(signed.key, PNG);
			expect(typeof (await completeUpload(tx, storage, actor, { key: signed.key, name }, IP))).toBe(
				'object'
			);
			// a second complete of the same key must not delete the object the library already holds
			expect(await completeUpload(tx, storage, actor, { key: signed.key, name }, IP)).toBe(
				'bad_key'
			);
			expect(storage.objects.has(signed.key)).toBe(true);
		});
	});

	it('moderator cannot complete an upload', async () => {
		await inRollback(async (tx) => {
			const storage = fakeStorage();
			const key = `media/2026/10/${crypto.randomUUID()}.png`;
			storage.objects.set(key, PNG);
			const actor = await staff(tx, 'moderator');
			expect(await completeUpload(tx, storage, actor, { key, name: 'a.png' }, IP)).toBe(
				'not_allowed'
			);
			expect(await tx.select().from(media).where(eq(media.key, key))).toHaveLength(0);
		});
	});
});
