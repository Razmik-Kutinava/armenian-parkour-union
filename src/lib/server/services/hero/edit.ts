import { isDeepStrictEqual } from 'node:util';
import { eq } from 'drizzle-orm';
import type { HeroValues } from '#lib/validation/hero.ts';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { heroBlocks } from '../../db/schema/hero';
import { writeAudit } from '../audit';
import { isUuid, type Actor } from '../users/target';
import { checkHeroRefs, lockHero, nextSortOrder, roomForActive } from './checks';

export { archiveHeroBlock, duplicateHeroBlock, restoreHeroBlock } from './lifecycle';

/* docs/05 section 4: create and edit; the limit of active blocks — docs/03 section 11. */

type Refusal =
	'not_allowed' | 'not_found' | 'bad_media' | 'bad_event' | 'bad_person' | 'limit' | 'bad_state';

const LOGGED = [
	'type',
	'title',
	'subtitle',
	'mediaKey',
	'videoUrl',
	'ctaLabel',
	'ctaUrl',
	'eventId',
	'personUserId',
	'startsAt',
	'endsAt',
	'isActive'
] as const;

export async function createHeroBlock(
	db: LimitDb,
	actor: Actor,
	values: HeroValues,
	ip: string | null
): Promise<{ id: string } | Exclude<Refusal, 'not_found' | 'bad_state'>> {
	if (!roleCan(actor.role, 'hero.write')) return 'not_allowed';
	return db.transaction(async (tx) => {
		const refs = await checkHeroRefs(tx, values);
		if (refs !== 'ok') return refs;
		if (values.isActive && !(await roomForActive(tx))) return 'limit' as const;
		const [row] = await tx
			.insert(heroBlocks)
			.values({ ...values, sortOrder: await nextSortOrder(tx), createdBy: actor.id })
			.returning({ id: heroBlocks.id });
		const { type, title, isActive } = values;
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'hero.create',
			entityType: 'hero_block',
			entityId: row.id,
			after: { type, title, isActive },
			ip
		});
		return { id: row.id };
	});
}

/** An archived block is not edited: it comes back by "Restore". */
export async function updateHeroBlock(
	db: LimitDb,
	actor: Actor,
	id: string,
	values: HeroValues,
	ip: string | null
): Promise<'ok' | Refusal> {
	if (!roleCan(actor.role, 'hero.write')) return 'not_allowed';
	if (!isUuid(id)) return 'not_found';
	return db.transaction(async (tx) => {
		const block = await lockHero(tx, id);
		if (!block) return 'not_found' as const;
		if (block.archivedAt) return 'bad_state' as const;
		const before: Record<string, unknown> = {};
		const after: Record<string, unknown> = {};
		for (const key of LOGGED) {
			if (isDeepStrictEqual(block[key], values[key])) continue;
			before[key] = block[key];
			after[key] = values[key];
		}
		if (Object.keys(after).length === 0) return 'ok' as const;
		const refs = await checkHeroRefs(tx, values);
		if (refs !== 'ok') return refs;
		if (values.isActive && !block.isActive && !(await roomForActive(tx, block.id))) {
			return 'limit' as const;
		}
		await tx.update(heroBlocks).set(values).where(eq(heroBlocks.id, block.id));
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'hero.update',
			entityType: 'hero_block',
			entityId: block.id,
			before,
			after,
			ip
		});
		return 'ok' as const;
	});
}
