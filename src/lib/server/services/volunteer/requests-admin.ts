import { and, eq, sql } from 'drizzle-orm';
import type { LocalizedText } from '#lib/i18n/localized.ts';
import type { PostText } from '#lib/validation/posts.ts';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { volunteerInvitations, volunteerRequests } from '../../db/schema/volunteer-requests';
import { writeAudit } from '../audit';
import { isUuid, type Actor } from '../users/target';

export {
	cancelRequest,
	countNewInvites,
	inviteMore,
	publishRequest,
	type CardDeps
} from './requests-send';

/* docs/03 section 19.5 pp. 1, 7; docs/05 section 28 "Requests": create and edit. */

export type RequestValues = {
	title: LocalizedText;
	description: PostText | null;
	eventId: string | null;
	startsAt: Date;
	endsAt: Date;
	location: string | null;
	places: number;
	respondBy: Date;
};

type Refusal = 'not_allowed' | 'not_found' | 'bad_state' | 'times' | 'places' | 'respond_by';
const canManage = (actor: Actor) => roleCan(actor.role, 'volunteer.manage');
const timesOk = (v: RequestValues) => v.endsAt >= v.startsAt && v.respondBy <= v.startsAt;
const placesOk = (places: number) => Number.isInteger(places) && places >= 1;

export async function createRequest(
	db: LimitDb,
	actor: Actor,
	values: RequestValues,
	ip: string | null
): Promise<{ id: string } | Refusal> {
	if (!canManage(actor)) return 'not_allowed';
	if (!placesOk(values.places)) return 'places';
	if (!timesOk(values)) return 'times';
	if (values.eventId && !isUuid(values.eventId)) return 'not_found';
	return db.transaction(async (tx) => {
		const [row] = await tx
			.insert(volunteerRequests)
			.values({
				title: values.title,
				description: values.description,
				eventId: values.eventId,
				startsAt: values.startsAt,
				endsAt: values.endsAt,
				location: values.location,
				places: values.places,
				respondBy: values.respondBy,
				createdBy: actor.id
			})
			.returning({ id: volunteerRequests.id });
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'volunteer_request.create',
			entityType: 'volunteer_request',
			entityId: row.id,
			after: { status: 'draft', places: values.places },
			ip
		});
		return { id: row.id };
	});
}

export async function updateRequest(
	db: LimitDb,
	actor: Actor,
	id: string,
	values: RequestValues,
	ip: string | null
): Promise<{ ok: true } | { ok: false; reason: Refusal }> {
	if (!canManage(actor)) return { ok: false, reason: 'not_allowed' };
	if (!isUuid(id)) return { ok: false, reason: 'not_found' };
	if (!placesOk(values.places)) return { ok: false, reason: 'places' };
	if (!timesOk(values)) return { ok: false, reason: 'respond_by' };
	return db.transaction(async (tx) => {
		const [row] = await tx
			.select()
			.from(volunteerRequests)
			.where(eq(volunteerRequests.id, id))
			.for('update');
		if (!row) return { ok: false, reason: 'not_found' as const };
		if (row.status === 'draft') {
			await tx
				.update(volunteerRequests)
				.set({
					title: values.title,
					description: values.description,
					eventId: values.eventId,
					startsAt: values.startsAt,
					endsAt: values.endsAt,
					location: values.location,
					places: values.places,
					respondBy: values.respondBy
				})
				.where(eq(volunteerRequests.id, id));
			await writeAudit(tx, {
				actorId: actor.id,
				action: 'volunteer_request.update',
				entityType: 'volunteer_request',
				entityId: id,
				ip
			});
			return { ok: true } as const;
		}
		if (row.status !== 'open') return { ok: false, reason: 'bad_state' as const };
		const [{ accepted }] = await tx
			.select({ accepted: sql<number>`count(*)::int` })
			.from(volunteerInvitations)
			.where(
				and(eq(volunteerInvitations.requestId, id), eq(volunteerInvitations.status, 'accepted'))
			);
		if (values.places < accepted) return { ok: false, reason: 'places' as const };
		const now = new Date();
		if (row.respondBy <= now) return { ok: false, reason: 'respond_by' as const };
		if (values.respondBy <= now || values.respondBy > row.startsAt) {
			return { ok: false, reason: 'respond_by' as const };
		}
		await tx
			.update(volunteerRequests)
			.set({ places: values.places, respondBy: values.respondBy })
			.where(eq(volunteerRequests.id, id));
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'volunteer_request.update',
			entityType: 'volunteer_request',
			entityId: id,
			before: { places: row.places, respondBy: row.respondBy },
			after: { places: values.places, respondBy: values.respondBy },
			ip
		});
		return { ok: true } as const;
	});
}
