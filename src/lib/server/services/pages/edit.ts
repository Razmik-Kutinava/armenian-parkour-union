import { isDeepStrictEqual } from 'node:util';
import { and, eq, isNull, ne, sql } from 'drizzle-orm';
import { isSystemSlug, type PageValues } from '#lib/validation/pages.ts';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { pages } from '../../db/schema/content';
import { writeAudit } from '../audit';
import { isUuid, type Actor } from '../users/target';
import { lockPageMedia } from './media';

type Refusal = 'not_allowed' | 'not_found' | 'slug_taken';

/** Deleted pages keep their address too (unique in the table); system addresses are reserved. */
async function slugTaken(tx: LimitDb, slug: string, exceptId?: string) {
	if (isSystemSlug(slug)) return true;
	const [row] = await tx
		.select({ id: pages.id })
		.from(pages)
		.where(exceptId ? and(eq(pages.slug, slug), ne(pages.id, exceptId)) : eq(pages.slug, slug));
	return !!row;
}

export async function createPage(
	db: LimitDb,
	actor: Actor,
	values: PageValues,
	ip: string | null
): Promise<{ id: string } | Exclude<Refusal, 'not_found'>> {
	if (!roleCan(actor.role, 'pages.write')) return 'not_allowed';
	return db.transaction(async (tx) => {
		if (await slugTaken(tx, values.slug)) return 'slug_taken' as const;
		await lockPageMedia(tx, values.body);
		const [row] = await tx
			.insert(pages)
			.values({ ...values, updatedBy: actor.id })
			.returning({ id: pages.id });
		const { slug, title, status } = values;
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'page.create',
			entityType: 'page',
			entityId: row.id,
			after: { slug, title, status },
			ip
		});
		return { id: row.id };
	});
}

/** The address of a system page never changes, whatever the form sends (docs/05 section 19). */
export async function updatePage(
	db: LimitDb,
	actor: Actor,
	id: string,
	values: PageValues,
	ip: string | null
): Promise<'ok' | Refusal> {
	if (!roleCan(actor.role, 'pages.write')) return 'not_allowed';
	if (!isUuid(id)) return 'not_found';
	return db.transaction(async (tx) => {
		const [page] = await tx
			.select()
			.from(pages)
			.where(and(eq(pages.id, id), isNull(pages.deletedAt)))
			.for('update');
		if (!page) return 'not_found' as const;
		const next = { ...values, slug: page.isSystem ? page.slug : values.slug };
		if (next.slug !== page.slug && (await slugTaken(tx, next.slug, page.id))) {
			return 'slug_taken' as const;
		}
		const before: Record<string, unknown> = {};
		const after: Record<string, unknown> = {};
		for (const key of ['slug', 'title', 'status'] as const) {
			if (isDeepStrictEqual(page[key], next[key])) continue;
			before[key] = page[key];
			after[key] = next[key];
		}
		const bodyChanged = !isDeepStrictEqual(page.body, next.body);
		if (!bodyChanged && Object.keys(after).length === 0) return 'ok' as const;
		await lockPageMedia(tx, next.body);
		await tx
			.update(pages)
			.set({ ...next, updatedBy: actor.id })
			.where(eq(pages.id, page.id));
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'page.update',
			entityType: 'page',
			entityId: page.id,
			before,
			after: bodyChanged ? { ...after, bodyChanged: true } : after,
			ip
		});
		return 'ok' as const;
	});
}

export async function deletePage(
	db: LimitDb,
	actor: Actor,
	id: string,
	ip: string | null
): Promise<'ok' | 'system' | Exclude<Refusal, 'slug_taken'>> {
	if (!roleCan(actor.role, 'pages.write')) return 'not_allowed';
	if (!isUuid(id)) return 'not_found';
	return db.transaction(async (tx) => {
		const [page] = await tx
			.select({ id: pages.id, slug: pages.slug, isSystem: pages.isSystem })
			.from(pages)
			.where(and(eq(pages.id, id), isNull(pages.deletedAt)))
			.for('update');
		if (!page) return 'not_found' as const;
		if (page.isSystem) return 'system' as const;
		await tx
			.update(pages)
			.set({ deletedAt: sql`now()`, updatedBy: actor.id })
			.where(eq(pages.id, page.id));
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'page.delete',
			entityType: 'page',
			entityId: page.id,
			before: { slug: page.slug },
			ip
		});
		return 'ok' as const;
	});
}
