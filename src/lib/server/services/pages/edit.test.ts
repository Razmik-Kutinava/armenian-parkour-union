import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { PageValues } from '#lib/validation/pages.ts';
import type { LimitDb } from '../../auth/rate-limit';
import type { UserRole } from '../../auth/session';
import { pages } from '../../db/schema/content';
import { auditLog } from '../../db/schema/service';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { createPage, deletePage, updatePage } from './edit';
import { getPage, listPages } from './list';

const IP = '198.51.100.9';
const values = (slug: string, extra: Partial<PageValues> = {}): PageValues => ({
	slug,
	title: { en: 'Summer camp' },
	body: { en: '<p>Text</p>' },
	status: 'draft',
	...extra
});

describe.skipIf(!testDbUrl)('pages: admin edits (docs/05 section 19)', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	const staff = async (tx: LimitDb, role: UserRole = 'editor') => ({
		id: (await insertUser(tx, { role })).id,
		role
	});
	const slug = () => `t-${crypto.randomUUID().slice(0, 8)}`;
	const auditOf = (tx: LimitDb, id: string) =>
		tx.select().from(auditLog).where(eq(auditLog.entityId, id));
	const systemPage = async (tx: LimitDb) => {
		const [row] = await tx
			.insert(pages)
			.values({ slug: slug(), title: { en: 'Rules' }, isSystem: true })
			.returning();
		return row;
	};

	it('editor creates a page; it is listed and logged', async () => {
		await inRollback(async (tx) => {
			const actor = await staff(tx);
			const s = slug();
			const created = await createPage(tx, actor, values(s), IP);
			if (typeof created === 'string') throw new Error(created);
			expect(await getPage(tx, created.id)).toMatchObject({
				slug: s,
				title: { en: 'Summer camp' },
				body: { en: '<p>Text</p>' },
				status: 'draft',
				isSystem: false
			});
			expect((await listPages(tx)).some((p) => p.id === created.id)).toBe(true);
			const [entry] = await auditOf(tx, created.id);
			expect(entry).toMatchObject({
				action: 'page.create',
				actorId: actor.id,
				entityType: 'page',
				after: { slug: s, title: { en: 'Summer camp' }, status: 'draft' },
				ip: IP
			});
		});
	});

	it('a taken address is refused, also when the page with it is deleted', async () => {
		await inRollback(async (tx) => {
			const actor = await staff(tx, 'admin');
			const s = slug();
			const first = await createPage(tx, actor, values(s), IP);
			if (typeof first === 'string') throw new Error(first);
			expect(await createPage(tx, actor, values(s), IP)).toBe('slug_taken');
			expect(await deletePage(tx, actor, first.id, IP)).toBe('ok');
			expect(await createPage(tx, actor, values(s), IP)).toBe('slug_taken');
		});
	});

	it('an ordinary page cannot take a system address, even before the seed ran', async () => {
		await inRollback(async (tx) => {
			const actor = await staff(tx, 'admin');
			await tx.delete(pages).where(eq(pages.slug, 'refund-policy'));
			expect(await createPage(tx, actor, values('refund-policy'), IP)).toBe('slug_taken');
			const created = await createPage(tx, actor, values(slug()), IP);
			if (typeof created === 'string') throw new Error(created);
			expect(await updatePage(tx, actor, created.id, values('about'), IP)).toBe('slug_taken');
		});
	});

	it('update saves every field and logs only what changed', async () => {
		await inRollback(async (tx) => {
			const actor = await staff(tx);
			const s = slug();
			const created = await createPage(tx, actor, values(s), IP);
			if (typeof created === 'string') throw new Error(created);
			const s2 = slug();
			const next = values(s2, { title: { en: 'Camp', hy: 'Ճամբար' }, status: 'published' });
			expect(await updatePage(tx, actor, created.id, next, IP)).toBe('ok');
			expect(await getPage(tx, created.id)).toMatchObject({ ...next, updatedBy: actor.id });
			const entries = (await auditOf(tx, created.id)).filter((e) => e.action === 'page.update');
			expect(entries).toHaveLength(1);
			expect(entries[0]).toMatchObject({
				before: { slug: s, title: { en: 'Summer camp' }, status: 'draft' },
				after: { slug: s2, title: { en: 'Camp', hy: 'Ճամբար' }, status: 'published' }
			});
			expect(entries[0].before).not.toHaveProperty('body');
		});
	});

	it('changing an address to a taken one is refused and nothing changes', async () => {
		await inRollback(async (tx) => {
			const actor = await staff(tx);
			const taken = slug();
			await createPage(tx, actor, values(taken), IP);
			const own = slug();
			const page = await createPage(tx, actor, values(own), IP);
			if (typeof page === 'string') throw new Error(page);
			const next = values(taken, { status: 'published' });
			expect(await updatePage(tx, actor, page.id, next, IP)).toBe('slug_taken');
			expect(await getPage(tx, page.id)).toMatchObject({ slug: own, status: 'draft' });
		});
	});

	it('a system page keeps its address, even from a hostile form, and is never deleted', async () => {
		await inRollback(async (tx) => {
			const actor = await staff(tx, 'admin');
			const page = await systemPage(tx);
			const next = values('hijacked', { title: { en: 'Rules of the federation' } });
			expect(await updatePage(tx, actor, page.id, next, IP)).toBe('ok');
			expect(await getPage(tx, page.id)).toMatchObject({
				slug: page.slug,
				title: { en: 'Rules of the federation' },
				isSystem: true
			});
			expect(await deletePage(tx, actor, page.id, IP)).toBe('system');
			expect((await getPage(tx, page.id))?.deletedAt).toBeNull();
			expect((await auditOf(tx, page.id)).map((e) => e.action)).toEqual(['page.update']);
		});
	});

	it('delete is soft: hidden from the list and the admin, row stays, logged', async () => {
		await inRollback(async (tx) => {
			const actor = await staff(tx);
			const created = await createPage(tx, actor, values(slug()), IP);
			if (typeof created === 'string') throw new Error(created);
			expect(await deletePage(tx, actor, created.id, IP)).toBe('ok');
			const [row] = await tx.select().from(pages).where(eq(pages.id, created.id));
			expect(row.deletedAt).not.toBeNull();
			expect(await getPage(tx, created.id)).toBeNull();
			expect((await listPages(tx)).some((p) => p.id === created.id)).toBe(false);
			expect((await auditOf(tx, created.id)).map((e) => e.action).sort()).toEqual([
				'page.create',
				'page.delete'
			]);
			expect(await deletePage(tx, actor, created.id, IP)).toBe('not_found');
			expect(await updatePage(tx, actor, created.id, values(slug()), IP)).toBe('not_found');
		});
	});

	it('moderator and member change nothing', async () => {
		await inRollback(async (tx) => {
			const owner = await staff(tx);
			const created = await createPage(tx, owner, values(slug()), IP);
			if (typeof created === 'string') throw new Error(created);
			for (const role of ['moderator', 'member'] as const) {
				const actor = await staff(tx, role);
				expect(await createPage(tx, actor, values(slug()), IP)).toBe('not_allowed');
				expect(await updatePage(tx, actor, created.id, values(slug()), IP)).toBe('not_allowed');
				expect(await deletePage(tx, actor, created.id, IP)).toBe('not_allowed');
			}
			expect((await auditOf(tx, created.id)).map((e) => e.action)).toEqual(['page.create']);
		});
	});

	it('unknown or malformed id is not found', async () => {
		await inRollback(async (tx) => {
			const actor = await staff(tx);
			expect(await updatePage(tx, actor, 'nope', values(slug()), IP)).toBe('not_found');
			expect(await deletePage(tx, actor, crypto.randomUUID(), IP)).toBe('not_found');
			expect(await getPage(tx, 'nope')).toBeNull();
		});
	});
});
