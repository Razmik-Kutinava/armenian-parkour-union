import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import type { UserRole } from '../../auth/session';
import { auditLog, media } from '../../db/schema/service';
import { users } from '../../db/schema/users';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { deleteMedia, updateAlt } from './edit';
import { getMedia, listMedia } from './list';
import { findUsages } from './usage';

const IP = '198.51.100.8';
const state = { page: 1, sort: 'createdAt', dir: 'desc' as const, q: '', filters: {} };

describe.skipIf(!testDbUrl)('media library: alt, usage, delete (docs/05 section 20)', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	const staff = async (tx: LimitDb, role: UserRole = 'editor') => ({
		id: (await insertUser(tx, { role })).id,
		role
	});
	const addFile = async (
		tx: LimitDb,
		uploadedBy: string,
		name = 'file.png',
		mime = 'image/png'
	) => {
		const ext = mime === 'application/pdf' ? 'pdf' : 'png';
		const [row] = await tx
			.insert(media)
			.values({
				key: `media/2026/10/${crypto.randomUUID()}.${ext}`,
				originalName: name,
				mime,
				sizeBytes: 100,
				uploadedBy
			})
			.returning();
		return row;
	};
	const auditOf = (tx: LimitDb, id: string) =>
		tx.select().from(auditLog).where(eq(auditLog.entityId, id));

	it('alt text is saved per language and logged with before and after', async () => {
		await inRollback(async (tx) => {
			const actor = await staff(tx);
			const file = await addFile(tx, actor.id);
			expect(await updateAlt(tx, actor, file.id, { en: 'Jump', ru: 'Прыжок' }, IP)).toBe('ok');
			expect((await getMedia(tx, file.id))?.alt).toEqual({ en: 'Jump', ru: 'Прыжок' });
			const [entry] = await auditOf(tx, file.id);
			expect(entry).toMatchObject({
				action: 'media.update',
				before: { alt: null },
				after: { alt: { en: 'Jump', ru: 'Прыжок' } },
				ip: IP
			});
		});
	});

	it('an unused file is deleted softly: hidden from the library, row and object stay', async () => {
		await inRollback(async (tx) => {
			const actor = await staff(tx, 'admin');
			const file = await addFile(tx, actor.id);
			expect(await deleteMedia(tx, actor, file.id, IP)).toBe('ok');
			const [row] = await tx.select().from(media).where(eq(media.id, file.id));
			expect(row.deletedAt).not.toBeNull();
			expect(await getMedia(tx, file.id)).toBeNull();
			expect((await auditOf(tx, file.id)).map((e) => e.action)).toEqual(['media.delete']);
			expect(await deleteMedia(tx, actor, file.id, IP)).toBe('not_found');
		});
	});

	it('a file in use is not deleted; the answer says where it is used', async () => {
		await inRollback(async (tx) => {
			const actor = await staff(tx);
			const file = await addFile(tx, actor.id);
			const member = await insertUser(tx);
			await tx.update(users).set({ avatarKey: file.key }).where(eq(users.id, member.id));

			expect(await findUsages(tx, file.key)).toEqual([{ kind: 'user_avatar', id: member.id }]);
			expect(await deleteMedia(tx, actor, file.id, IP)).toEqual({
				inUse: [{ kind: 'user_avatar', id: member.id }]
			});
			expect((await getMedia(tx, file.id))?.deletedAt).toBeNull();
			expect(await auditOf(tx, file.id)).toHaveLength(0);
		});
	});

	it('moderator and member change nothing', async () => {
		await inRollback(async (tx) => {
			const owner = await staff(tx);
			const file = await addFile(tx, owner.id);
			for (const role of ['moderator', 'member'] as const) {
				const actor = await staff(tx, role);
				expect(await updateAlt(tx, actor, file.id, { en: 'x' }, IP)).toBe('not_allowed');
				expect(await deleteMedia(tx, actor, file.id, IP)).toBe('not_allowed');
			}
			expect(await getMedia(tx, file.id)).toMatchObject({ alt: null, deletedAt: null });
		});
	});

	it('unknown or malformed id is not found', async () => {
		await inRollback(async (tx) => {
			const actor = await staff(tx);
			expect(await updateAlt(tx, actor, 'nope', { en: 'x' }, IP)).toBe('not_found');
			expect(await deleteMedia(tx, actor, crypto.randomUUID(), IP)).toBe('not_found');
		});
	});

	it('list: search by file name, filter by kind, deleted files hidden', async () => {
		await inRollback(async (tx) => {
			const actor = await staff(tx);
			const tag = crypto.randomUUID().slice(0, 8);
			const photo = await addFile(tx, actor.id, `${tag}-photo.png`);
			const doc = await addFile(tx, actor.id, `${tag}-rules.pdf`, 'application/pdf');
			const gone = await addFile(tx, actor.id, `${tag}-old.png`);
			await deleteMedia(tx, { id: actor.id, role: 'editor' }, gone.id, IP);

			const all = await listMedia(tx, { ...state, q: tag });
			expect(all.rows.map((r) => r.id).sort()).toEqual([photo.id, doc.id].sort());
			expect(all.total).toBe(2);
			const images = await listMedia(tx, { ...state, q: tag, filters: { kind: 'image' } });
			expect(images.rows.map((r) => r.id)).toEqual([photo.id]);
			const pdfs = await listMedia(tx, { ...state, q: tag, filters: { kind: 'pdf' } });
			expect(pdfs.rows.map((r) => r.id)).toEqual([doc.id]);
			expect(
				(await listMedia(tx, { ...state, q: '%' })).rows.every((r) => r.originalName.includes('%'))
			).toBe(true);
		});
	});
});
