import { eq, sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { heroBlocks } from '../../db/schema/hero';
import { auditLog } from '../../db/schema/service';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { findUsages } from '../media/usage';
import {
	archiveHeroBlock,
	createHeroBlock,
	duplicateHeroBlock,
	restoreHeroBlock,
	updateHeroBlock
} from './edit';
import { getHeroBlock } from './list';
import {
	IP,
	birthDateAgo,
	clearHero,
	createdHero,
	heroValues,
	insertEvent,
	insertImage,
	setHeroLimit,
	staff
} from './test-support';

describe.skipIf(!testDbUrl)('hero: admin edits (docs/05 section 4, docs/04)', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	const auditOf = (tx: LimitDb, id: string) =>
		tx.select().from(auditLog).where(eq(auditLog.entityId, id));
	const rowOf = async (tx: LimitDb, id: string) =>
		(await tx.select().from(heroBlocks).where(eq(heroBlocks.id, id)))[0];

	it('editor creates a block with every field; created_by and the log are written', async () => {
		await inRollback(async (tx) => {
			await clearHero(tx);
			const actor = await staff(tx);
			const v = heroValues({
				title: { en: 'Join us', ru: 'Вступай' },
				subtitle: { en: 'Parkour in Armenia' },
				mediaKey: await insertImage(tx),
				ctaLabel: { en: 'Join' },
				ctaUrl: '/register',
				startsAt: new Date(Date.now() - 3_600_000),
				endsAt: new Date(Date.now() + 3_600_000)
			});
			const id = await createdHero(tx, actor, v);
			expect(await getHeroBlock(tx, id)).toMatchObject({
				...v,
				id,
				archivedAt: null,
				createdBy: actor.id
			});
			const [entry] = await auditOf(tx, id);
			expect(entry).toMatchObject({
				action: 'hero.create',
				actorId: actor.id,
				entityType: 'hero_block',
				after: { type: 'custom', title: v.title, isActive: false },
				ip: IP
			});
		});
	});

	it('a new block goes to the end of the order', async () => {
		await inRollback(async (tx) => {
			await clearHero(tx);
			const actor = await staff(tx);
			const first = await createdHero(tx, actor, heroValues());
			const second = await createdHero(tx, actor, heroValues());
			expect((await rowOf(tx, second)).sortOrder).toBeGreaterThan(
				(await rowOf(tx, first)).sortOrder
			);
		});
	});

	it('background is a library image; the file then counts as used', async () => {
		await inRollback(async (tx) => {
			await clearHero(tx);
			const actor = await staff(tx);
			const image = await insertImage(tx);
			const id = await createdHero(tx, actor, heroValues({ mediaKey: image }));
			expect(await findUsages(tx, image)).toContainEqual({ kind: 'hero', id });
			const pdf = await insertImage(tx, 'application/pdf');
			for (const mediaKey of [pdf, `media/2026/10/${crypto.randomUUID()}.png`]) {
				expect(await createHeroBlock(tx, actor, heroValues({ mediaKey }), IP)).toBe('bad_media');
				expect(await updateHeroBlock(tx, actor, id, heroValues({ mediaKey }), IP)).toBe(
					'bad_media'
				);
			}
			expect(await archiveHeroBlock(tx, actor, id, IP)).toBe('ok');
			expect(await findUsages(tx, image)).toContainEqual({ kind: 'hero', id });
		});
	});

	it('event block: the event must exist and not be deleted; a draft is allowed', async () => {
		await inRollback(async (tx) => {
			await clearHero(tx);
			const actor = await staff(tx);
			const draft = await insertEvent(tx, { status: 'draft', publishedAt: null });
			const id = await createdHero(tx, actor, heroValues({ type: 'event', eventId: draft.id }));
			expect((await rowOf(tx, id)).eventId).toBe(draft.id);
			const deleted = await insertEvent(tx, { deletedAt: new Date() });
			for (const eventId of [deleted.id, crypto.randomUUID()]) {
				expect(await createHeroBlock(tx, actor, heroValues({ type: 'event', eventId }), IP)).toBe(
					'bad_event'
				);
			}
		});
	});

	it('person block: only an active adult who is not deleted (K4)', async () => {
		await inRollback(async (tx) => {
			await clearHero(tx);
			const actor = await staff(tx);
			const person = (personUserId: string) => heroValues({ type: 'person', personUserId });
			const adult = await insertUser(tx, { birthDate: birthDateAgo(18, 2) });
			expect(typeof (await createHeroBlock(tx, actor, person(adult.id), IP))).toBe('object');
			const refused = [
				await insertUser(tx, { birthDate: birthDateAgo(18, -2) }),
				await insertUser(tx, { birthDate: null }),
				await insertUser(tx, { birthDate: birthDateAgo(30), status: 'blocked' }),
				await insertUser(tx, { birthDate: birthDateAgo(30), deletedAt: new Date() })
			];
			for (const user of [...refused, { id: crypto.randomUUID() }]) {
				expect(await createHeroBlock(tx, actor, person(user.id), IP)).toBe('bad_person');
			}
		});
	});

	it('creating an active block counts against the limit', async () => {
		await inRollback(async (tx) => {
			await clearHero(tx);
			await setHeroLimit(tx, 1);
			const actor = await staff(tx);
			await createdHero(tx, actor, heroValues({ isActive: true }));
			expect(await createHeroBlock(tx, actor, heroValues({ isActive: true }), IP)).toBe('limit');
			const off = await createdHero(tx, actor, heroValues());
			expect(await updateHeroBlock(tx, actor, off, heroValues({ isActive: true }), IP)).toBe(
				'limit'
			);
		});
	});

	it('update saves every field and logs only what changed', async () => {
		await inRollback(async (tx) => {
			await clearHero(tx);
			const actor = await staff(tx);
			const id = await createdHero(tx, actor, heroValues());
			const next = heroValues({
				title: { en: 'New title' },
				ctaLabel: { en: 'Go' },
				ctaUrl: 'https://example.org',
				isActive: true
			});
			expect(await updateHeroBlock(tx, actor, id, next, IP)).toBe('ok');
			expect(await getHeroBlock(tx, id)).toMatchObject(next);
			const updates = (await auditOf(tx, id)).filter((e) => e.action === 'hero.update');
			expect(updates).toHaveLength(1);
			expect(updates[0]).toMatchObject({
				before: { title: { en: 'Hero' }, ctaLabel: null, ctaUrl: null, isActive: false },
				after: {
					title: { en: 'New title' },
					ctaLabel: { en: 'Go' },
					ctaUrl: 'https://example.org',
					isActive: true
				}
			});
			expect(updates[0].before).not.toHaveProperty('type');
			expect(await updateHeroBlock(tx, actor, id, next, IP)).toBe('ok');
			expect((await auditOf(tx, id)).filter((e) => e.action === 'hero.update')).toHaveLength(1);
		});
	});

	it('duplicate: an inactive copy at the end, logged with its source', async () => {
		await inRollback(async (tx) => {
			await clearHero(tx);
			const actor = await staff(tx);
			const v = heroValues({ title: { en: 'Source' }, subtitle: { en: 'Sub' }, isActive: true });
			const source = await createdHero(tx, actor, v);
			const other = await staff(tx, 'admin');
			const copy = await duplicateHeroBlock(tx, other, source, IP);
			if (typeof copy === 'string') throw new Error(copy);
			expect(await getHeroBlock(tx, copy.id)).toMatchObject({
				...v,
				isActive: false,
				createdBy: other.id
			});
			expect((await rowOf(tx, copy.id)).sortOrder).toBeGreaterThan(
				(await rowOf(tx, source)).sortOrder
			);
			const [entry] = await auditOf(tx, copy.id);
			expect(entry).toMatchObject({ action: 'hero.duplicate', after: { duplicatedFrom: source } });
		});
	});

	it('archive switches the block off; restore brings it back inactive at the end', async () => {
		await inRollback(async (tx) => {
			await clearHero(tx);
			const actor = await staff(tx);
			const id = await createdHero(tx, actor, heroValues({ isActive: true }));
			const later = await createdHero(tx, actor, heroValues());
			expect(await restoreHeroBlock(tx, actor, id, IP)).toBe('bad_state');
			expect(await archiveHeroBlock(tx, actor, id, IP)).toBe('ok');
			const archived = await rowOf(tx, id);
			expect(archived.archivedAt).not.toBeNull();
			expect(archived.isActive).toBe(false);
			expect(await archiveHeroBlock(tx, actor, id, IP)).toBe('bad_state');
			expect(await updateHeroBlock(tx, actor, id, heroValues(), IP)).toBe('bad_state');
			expect(await restoreHeroBlock(tx, actor, id, IP)).toBe('ok');
			const restored = await rowOf(tx, id);
			expect(restored).toMatchObject({ archivedAt: null, isActive: false });
			expect(restored.sortOrder).toBeGreaterThan((await rowOf(tx, later)).sortOrder);
			const actions = (await auditOf(tx, id)).map((e) => e.action);
			expect(actions).toEqual(['hero.create', 'hero.archive', 'hero.restore']);
		});
	});

	it('moderator and member change nothing', async () => {
		await inRollback(async (tx) => {
			await clearHero(tx);
			const id = await createdHero(tx, await staff(tx), heroValues());
			for (const role of ['moderator', 'member'] as const) {
				const actor = await staff(tx, role);
				expect(await createHeroBlock(tx, actor, heroValues(), IP)).toBe('not_allowed');
				expect(await updateHeroBlock(tx, actor, id, heroValues(), IP)).toBe('not_allowed');
				expect(await duplicateHeroBlock(tx, actor, id, IP)).toBe('not_allowed');
				expect(await archiveHeroBlock(tx, actor, id, IP)).toBe('not_allowed');
				expect(await restoreHeroBlock(tx, actor, id, IP)).toBe('not_allowed');
			}
			expect((await auditOf(tx, id)).map((e) => e.action)).toEqual(['hero.create']);
		});
	});

	it('the database refuses a block without the field its type needs', async () => {
		await inRollback(async (tx) => {
			for (const type of ['event', 'person', 'video'] as const) {
				const insert = tx.transaction((sp) =>
					sp.insert(heroBlocks).values({ type, title: { en: 'Bad' } })
				);
				await expect(insert, type).rejects.toThrow();
			}
			await tx.execute(sql`select 1`);
		});
	});

	it('unknown or malformed id is not found', async () => {
		await inRollback(async (tx) => {
			const actor = await staff(tx, 'admin');
			expect(await updateHeroBlock(tx, actor, 'nope', heroValues(), IP)).toBe('not_found');
			expect(await archiveHeroBlock(tx, actor, crypto.randomUUID(), IP)).toBe('not_found');
			expect(await duplicateHeroBlock(tx, actor, crypto.randomUUID(), IP)).toBe('not_found');
			expect(await getHeroBlock(tx, 'nope')).toBeNull();
		});
	});
});
