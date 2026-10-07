import { and, eq, isNull, sql } from 'drizzle-orm';
import type { AltText } from '#lib/validation/media.ts';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { media } from '../../db/schema/service';
import { writeAudit } from '../audit';
import { isUuid, type Actor } from '../users/target';
import { findUsages, type MediaUsage } from './usage';

type Refusal = 'not_allowed' | 'not_found';

async function lockFile(tx: LimitDb, id: string) {
	if (!isUuid(id)) return null;
	const [row] = await tx
		.select({ id: media.id, key: media.key, alt: media.alt })
		.from(media)
		.where(and(eq(media.id, id), isNull(media.deletedAt)))
		.for('update');
	return row ?? null;
}

export async function updateAlt(
	db: LimitDb,
	actor: Actor,
	id: string,
	alt: AltText,
	ip: string | null
): Promise<'ok' | Refusal> {
	if (!roleCan(actor.role, 'media.write')) return 'not_allowed';
	return db.transaction(async (tx) => {
		const file = await lockFile(tx, id);
		if (!file) return 'not_found' as const;
		await tx.update(media).set({ alt }).where(eq(media.id, file.id));
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'media.update',
			entityType: 'media',
			entityId: file.id,
			before: { alt: file.alt },
			after: { alt },
			ip
		});
		return 'ok' as const;
	});
}

/**
 * docs/05 section 20: a used file is not deleted, the answer lists where it is used. Soft delete
 * (decisions.md 2026-10-07): the row is hidden, the object stays in the bucket.
 */
export async function deleteMedia(
	db: LimitDb,
	actor: Actor,
	id: string,
	ip: string | null
): Promise<'ok' | Refusal | { inUse: MediaUsage[] }> {
	if (!roleCan(actor.role, 'media.write')) return 'not_allowed';
	return db.transaction(async (tx) => {
		const file = await lockFile(tx, id);
		if (!file) return 'not_found' as const;
		const usages = await findUsages(tx, file.key);
		if (usages.length > 0) return { inUse: usages };
		await tx
			.update(media)
			.set({ deletedAt: sql`now()` })
			.where(eq(media.id, file.id));
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'media.delete',
			entityType: 'media',
			entityId: file.id,
			before: { key: file.key },
			ip
		});
		return 'ok' as const;
	});
}
