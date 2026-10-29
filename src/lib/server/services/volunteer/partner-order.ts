import { eq } from 'drizzle-orm';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { volunteerPartners } from '../../db/schema/volunteer-partners';
import { writeAudit } from '../audit';
import { isUuid, type Actor } from '../users/target';
import { partnerOrder } from './partner-list';

/**
 * docs/05 section 28: ↑ / ↓ swaps with the neighbour and numbers every partner 0…n−1. All partner
 * rows are locked first, so two moves wait for each other; at the edge nothing changes.
 */
export async function movePartner(
	db: LimitDb,
	actor: Actor,
	partnerId: string,
	direction: 'up' | 'down',
	ip: string | null
): Promise<'ok' | 'not_allowed' | 'not_found'> {
	if (!roleCan(actor.role, 'volunteer.manage')) return 'not_allowed';
	if (!isUuid(partnerId)) return 'not_found';
	return db.transaction(async (tx) => {
		const list = await tx
			.select({ id: volunteerPartners.id, sortOrder: volunteerPartners.sortOrder })
			.from(volunteerPartners)
			.orderBy(...partnerOrder)
			.for('update');
		const from = list.findIndex((p) => p.id === partnerId);
		if (from < 0) return 'not_found' as const;
		const to = direction === 'up' ? from - 1 : from + 1;
		if (to < 0 || to >= list.length) return 'ok' as const;
		[list[from], list[to]] = [list[to], list[from]];
		for (const [n, partner] of list.entries()) {
			if (partner.sortOrder === n) continue;
			await tx
				.update(volunteerPartners)
				.set({ sortOrder: n })
				.where(eq(volunteerPartners.id, partner.id));
		}
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'volunteer_partner.reorder',
			entityType: 'volunteer_partner',
			entityId: partnerId,
			before: { position: from + 1 },
			after: { position: to + 1 },
			ip
		});
		return 'ok' as const;
	});
}
