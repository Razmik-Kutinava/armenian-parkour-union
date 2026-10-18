import { eq } from 'drizzle-orm';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { heroBlocks } from '../../db/schema/hero';
import { writeAudit } from '../audit';
import { isUuid, type Actor } from '../users/target';
import { lockHero, roomForActive } from './checks';

/** docs/05 section 4: the on / off switch; switching on respects `hero_max_active`. */
export async function setHeroActive(
	db: LimitDb,
	actor: Actor,
	id: string,
	active: boolean,
	ip: string | null
): Promise<'ok' | 'not_allowed' | 'not_found' | 'bad_state' | 'limit'> {
	if (!roleCan(actor.role, 'hero.write')) return 'not_allowed';
	if (!isUuid(id)) return 'not_found';
	return db.transaction(async (tx) => {
		const block = await lockHero(tx, id);
		if (!block) return 'not_found' as const;
		if (block.archivedAt) return 'bad_state' as const;
		if (block.isActive === active) return 'ok' as const;
		if (active && !(await roomForActive(tx, block.id))) return 'limit' as const;
		await tx.update(heroBlocks).set({ isActive: active }).where(eq(heroBlocks.id, block.id));
		await writeAudit(tx, {
			actorId: actor.id,
			action: active ? 'hero.activate' : 'hero.deactivate',
			entityType: 'hero_block',
			entityId: block.id,
			before: { isActive: !active },
			after: { isActive: active },
			ip
		});
		return 'ok' as const;
	});
}
