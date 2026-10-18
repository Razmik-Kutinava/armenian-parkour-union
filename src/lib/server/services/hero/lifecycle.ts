import { eq, sql } from 'drizzle-orm';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { heroBlocks } from '../../db/schema/hero';
import { writeAudit } from '../audit';
import { isUuid, type Actor } from '../users/target';
import { lockHero, nextSortOrder } from './checks';

/* docs/05 section 4: duplicate, archive, restore (archive — decisions.md 2026-10-08, 2.6). */

type Refusal = 'not_allowed' | 'not_found';

/** An inactive copy at the end of the order. */
export async function duplicateHeroBlock(
	db: LimitDb,
	actor: Actor,
	id: string,
	ip: string | null
): Promise<{ id: string } | Refusal> {
	if (!roleCan(actor.role, 'hero.write')) return 'not_allowed';
	if (!isUuid(id)) return 'not_found';
	return db.transaction(async (tx) => {
		const source = await lockHero(tx, id);
		if (!source) return 'not_found' as const;
		const { type, title, subtitle, mediaKey, videoUrl, ctaLabel, ctaUrl } = source;
		const { eventId, personUserId, startsAt, endsAt } = source;
		const [row] = await tx
			.insert(heroBlocks)
			.values({
				...{ type, title, subtitle, mediaKey, videoUrl, ctaLabel, ctaUrl },
				...{ eventId, personUserId, startsAt, endsAt },
				isActive: false,
				sortOrder: await nextSortOrder(tx),
				createdBy: actor.id
			})
			.returning({ id: heroBlocks.id });
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'hero.duplicate',
			entityType: 'hero_block',
			entityId: row.id,
			after: { duplicatedFrom: source.id },
			ip
		});
		return { id: row.id };
	});
}

async function moveArchive(
	db: LimitDb,
	actor: Actor,
	id: string,
	archive: boolean,
	ip: string | null
): Promise<'ok' | Refusal | 'bad_state'> {
	if (!roleCan(actor.role, 'hero.write')) return 'not_allowed';
	if (!isUuid(id)) return 'not_found';
	return db.transaction(async (tx) => {
		const block = await lockHero(tx, id);
		if (!block) return 'not_found' as const;
		if (!!block.archivedAt === archive) return 'bad_state' as const;
		await tx
			.update(heroBlocks)
			.set(
				archive
					? { archivedAt: sql`now()`, isActive: false }
					: { archivedAt: null, isActive: false, sortOrder: await nextSortOrder(tx) }
			)
			.where(eq(heroBlocks.id, block.id));
		await writeAudit(tx, {
			actorId: actor.id,
			action: archive ? 'hero.archive' : 'hero.restore',
			entityType: 'hero_block',
			entityId: block.id,
			before: { isActive: block.isActive, archived: !archive },
			after: { isActive: false, archived: archive },
			ip
		});
		return 'ok' as const;
	});
}

/** Switched off and kept apart; the background stays "in use". */
export const archiveHeroBlock = (db: LimitDb, actor: Actor, id: string, ip: string | null) =>
	moveArchive(db, actor, id, true, ip);

/** Back to the list, inactive, at the end of the order. */
export const restoreHeroBlock = (db: LimitDb, actor: Actor, id: string, ip: string | null) =>
	moveArchive(db, actor, id, false, ip);
