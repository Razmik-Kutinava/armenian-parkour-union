import { asc, eq } from 'drizzle-orm';
import type { PostText } from '#lib/validation/posts.ts';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { eventCategories, events } from '../../db/schema/events';
import { writeAudit } from '../audit';
import { isUuid, type Actor } from '../users/target';
import { freeCopySlug, lockEvent, lockEventMedia } from './checks';

/** A draft copy with categories, dates and price, without a publication date (2.5 default 9). */
export async function duplicateEvent(
	db: LimitDb,
	actor: Actor,
	id: string,
	ip: string | null
): Promise<{ id: string } | 'not_allowed' | 'not_found'> {
	if (!roleCan(actor.role, 'events.write')) return 'not_allowed';
	if (!isUuid(id)) return 'not_found';
	return db.transaction(async (tx) => {
		const source = await lockEvent(tx, id);
		if (!source) return 'not_found' as const;
		const slug = await freeCopySlug(tx, source.slug);
		await lockEventMedia(tx, source.coverKey, source.description as PostText);
		const [row] = await tx
			.insert(events)
			.values({
				slug,
				title: source.title,
				description: source.description,
				coverKey: source.coverKey,
				startsAt: source.startsAt,
				endsAt: source.endsAt,
				locationName: source.locationName,
				address: source.address,
				city: source.city,
				latitude: source.latitude,
				longitude: source.longitude,
				capacity: source.capacity,
				priceAmountMinor: source.priceAmountMinor,
				priceCurrency: source.priceCurrency,
				registrationOpensAt: source.registrationOpensAt,
				registrationClosesAt: source.registrationClosesAt,
				status: 'draft',
				publishedAt: null,
				createdBy: actor.id
			})
			.returning({ id: events.id });
		const categories = await tx
			.select()
			.from(eventCategories)
			.where(eq(eventCategories.eventId, source.id))
			.orderBy(asc(eventCategories.sortOrder));
		if (categories.length > 0) {
			await tx.insert(eventCategories).values(
				categories.map(({ name, discipline, ageMin, ageMax, capacity, sortOrder }) => ({
					eventId: row.id,
					name,
					discipline,
					ageMin,
					ageMax,
					capacity,
					sortOrder
				}))
			);
		}
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'event.create',
			entityType: 'event',
			entityId: row.id,
			after: { slug, title: source.title, status: 'draft', duplicatedFrom: source.id },
			ip
		});
		return { id: row.id };
	});
}
