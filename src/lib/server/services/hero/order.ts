import { eq } from 'drizzle-orm';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { heroBlocks } from '../../db/schema/hero';
import { writeAudit } from '../audit';
import { type Actor } from '../users/target';
import { lockCurrentOrder } from './checks';

/**
 * docs/05 section 4: drag and drop or ↑ / ↓ send the whole list. It must hold exactly every block
 * that is not archived, so a stale page cannot drop or duplicate one.
 */
export async function reorderHeroBlocks(
	db: LimitDb,
	actor: Actor,
	ids: string[],
	ip: string | null
): Promise<'ok' | 'not_allowed' | 'bad_order'> {
	if (!roleCan(actor.role, 'hero.write')) return 'not_allowed';
	return db.transaction(async (tx) => {
		const current = await lockCurrentOrder(tx);
		const known = new Set(current);
		const same =
			ids.length === current.length &&
			new Set(ids).size === ids.length &&
			ids.every((id) => known.has(id));
		if (!same || ids.length === 0) return 'bad_order' as const;
		for (const [index, id] of ids.entries()) {
			await tx.update(heroBlocks).set({ sortOrder: index }).where(eq(heroBlocks.id, id));
		}
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'hero.reorder',
			entityType: 'hero_block',
			before: { order: current },
			after: { order: ids },
			ip
		});
		return 'ok' as const;
	});
}
