import { isDeepStrictEqual } from 'node:util';
import { eq, sql } from 'drizzle-orm';
import type { EventValues } from '#lib/validation/events.ts';
import type { PostText } from '#lib/validation/posts.ts';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { events } from '../../db/schema/events';
import { writeAudit } from '../audit';
import { isUuid, type Actor } from '../users/target';
import { dbNow, lockEvent, lockEventMedia, slugTaken } from './checks';

export { duplicateEvent } from './duplicate';
export { cancelEvent, changeEventStatus, deleteEvent } from './lifecycle';

type Refusal = 'not_allowed' | 'not_found' | 'slug_taken' | 'bad_cover';

const LOGGED = [
	'slug',
	'title',
	'coverKey',
	'startsAt',
	'endsAt',
	'locationName',
	'address',
	'city',
	'latitude',
	'longitude',
	'capacity',
	'priceAmountMinor',
	'priceCurrency',
	'registrationOpensAt',
	'registrationClosesAt',
	'status',
	'publishedAt'
] as const;

export async function createEvent(
	db: LimitDb,
	actor: Actor,
	values: EventValues,
	ip: string | null
): Promise<{ id: string } | Exclude<Refusal, 'not_found'>> {
	if (!roleCan(actor.role, 'events.write')) return 'not_allowed';
	return db.transaction(async (tx) => {
		if (await slugTaken(tx, values.slug)) return 'slug_taken' as const;
		if (!(await lockEventMedia(tx, values.coverKey, values.description))) {
			return 'bad_cover' as const;
		}
		const publishedAt = values.publishedAt ?? (values.status === 'published' ? sql`now()` : null);
		const [row] = await tx
			.insert(events)
			.values({ ...values, publishedAt, createdBy: actor.id })
			.returning({ id: events.id, publishedAt: events.publishedAt });
		const { slug, title, status } = values;
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'event.create',
			entityType: 'event',
			entityId: row.id,
			after: { slug, title, status, publishedAt: row.publishedAt },
			ip
		});
		return { id: row.id };
	});
}

/**
 * The form sets draft or published; a finished, cancelled or archived event keeps its status
 * (those change only by their buttons). A published event saved without a date keeps its date.
 */
export async function updateEvent(
	db: LimitDb,
	actor: Actor,
	id: string,
	values: EventValues,
	ip: string | null
): Promise<'ok' | Refusal> {
	if (!roleCan(actor.role, 'events.write')) return 'not_allowed';
	if (!isUuid(id)) return 'not_found';
	return db.transaction(async (tx) => {
		const event = await lockEvent(tx, id);
		if (!event) return 'not_found' as const;
		if (values.slug !== event.slug && (await slugTaken(tx, values.slug, event.id))) {
			return 'slug_taken' as const;
		}
		const fromForm = event.status === 'draft' || event.status === 'published';
		const status = fromForm ? values.status : event.status;
		let publishedAt = event.publishedAt;
		if (fromForm) {
			const keepDate = status === 'published' ? (event.publishedAt ?? (await dbNow(tx))) : null;
			publishedAt = values.publishedAt ?? keepDate;
		}
		const next = { ...values, status, publishedAt };
		const before: Record<string, unknown> = {};
		const after: Record<string, unknown> = {};
		for (const key of LOGGED) {
			if (isDeepStrictEqual(event[key], next[key])) continue;
			before[key] = event[key];
			after[key] = next[key];
		}
		const descriptionChanged = !isDeepStrictEqual(event.description, next.description);
		if (!descriptionChanged && Object.keys(after).length === 0) return 'ok' as const;
		if (!(await lockEventMedia(tx, next.coverKey, next.description as PostText))) {
			return 'bad_cover' as const;
		}
		await tx.update(events).set(next).where(eq(events.id, event.id));
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'event.update',
			entityType: 'event',
			entityId: event.id,
			before,
			after: descriptionChanged ? { ...after, descriptionChanged: true } : after,
			ip
		});
		return 'ok' as const;
	});
}
