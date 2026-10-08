import { eq, sql } from 'drizzle-orm';
import type { EventStatus } from '#lib/validation/events.ts';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { events } from '../../db/schema/events';
import { writeAudit } from '../audit';
import { isUuid, type Actor } from '../users/target';
import { dbNow, lockEvent } from './checks';

/* docs/05 section 5; who does what — docs/04 (events.write, events.cancel); 2.5 defaults 1–3. */

type Missing = 'not_allowed' | 'not_found';
export type StatusAction = 'publish' | 'unpublish' | 'finish' | 'archive' | 'restore';

const RULES: Record<
	StatusAction,
	{ permission: 'events.write' | 'events.cancel'; from: EventStatus[]; to: EventStatus }
> = {
	publish: { permission: 'events.write', from: ['draft'], to: 'published' },
	unpublish: { permission: 'events.write', from: ['published'], to: 'draft' },
	finish: { permission: 'events.cancel', from: ['published'], to: 'finished' },
	archive: {
		permission: 'events.cancel',
		from: ['draft', 'published', 'finished', 'cancelled'],
		to: 'archived'
	},
	restore: { permission: 'events.cancel', from: ['archived'], to: 'draft' }
};

/** Finish needs the event to have started (database clock). Publish without a date: now. */
export async function changeEventStatus(
	db: LimitDb,
	actor: Actor,
	id: string,
	action: StatusAction,
	ip: string | null
): Promise<'ok' | 'bad_status' | Missing> {
	const rule = RULES[action];
	if (!rule || !roleCan(actor.role, rule.permission)) return 'not_allowed';
	if (!isUuid(id)) return 'not_found';
	return db.transaction(async (tx) => {
		const event = await lockEvent(tx, id);
		if (!event) return 'not_found' as const;
		if (!rule.from.includes(event.status)) return 'bad_status' as const;
		if (action === 'finish' && event.startsAt > (await dbNow(tx))) return 'bad_status' as const;
		const publishedAt = action === 'publish' && !event.publishedAt ? await dbNow(tx) : undefined;
		await tx
			.update(events)
			.set({ status: rule.to, ...(publishedAt && { publishedAt }) })
			.where(eq(events.id, event.id));
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'event.update',
			entityType: 'event',
			entityId: event.id,
			before: { status: event.status },
			after: { status: rule.to, ...(publishedAt && { publishedAt }) },
			ip
		});
		return 'ok' as const;
	});
}

/** Admin only, with a reason in the log; no letters until registrations and mail exist. */
export async function cancelEvent(
	db: LimitDb,
	actor: Actor,
	id: string,
	reason: string,
	ip: string | null
): Promise<'ok' | 'bad_status' | Missing> {
	if (!roleCan(actor.role, 'events.cancel')) return 'not_allowed';
	if (!isUuid(id)) return 'not_found';
	return db.transaction(async (tx) => {
		const event = await lockEvent(tx, id);
		if (!event) return 'not_found' as const;
		if (event.status !== 'draft' && event.status !== 'published') return 'bad_status' as const;
		await tx.update(events).set({ status: 'cancelled' }).where(eq(events.id, event.id));
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'event.cancel',
			entityType: 'event',
			entityId: event.id,
			before: { status: event.status },
			after: { status: 'cancelled', reason },
			ip
		});
		return 'ok' as const;
	});
}

/** Soft: the row and its categories stay. Refused with registrations — from stage 5. */
export async function deleteEvent(
	db: LimitDb,
	actor: Actor,
	id: string,
	ip: string | null
): Promise<'ok' | Missing> {
	if (!roleCan(actor.role, 'events.write')) return 'not_allowed';
	if (!isUuid(id)) return 'not_found';
	return db.transaction(async (tx) => {
		const event = await lockEvent(tx, id);
		if (!event) return 'not_found' as const;
		await tx
			.update(events)
			.set({ deletedAt: sql`now()` })
			.where(eq(events.id, event.id));
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'event.delete',
			entityType: 'event',
			entityId: event.id,
			before: { slug: event.slug, status: event.status },
			ip
		});
		return 'ok' as const;
	});
}
