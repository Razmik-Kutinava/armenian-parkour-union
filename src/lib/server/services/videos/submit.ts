import { and, count, eq, gte } from 'drizzle-orm';
import { startOfYerevanDay } from '#lib/validation/consents.ts';
import { yerevanDay } from '#lib/validation/admin-payments.ts';
import type { VideoForm } from '#lib/validation/videos.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { events } from '../../db/schema/events';
import { users } from '../../db/schema/users';
import { videos } from '../../db/schema/videos';
import { getMembershipOverview } from '../memberships/overview';
import { isUuid } from '../users/target';
import { startedShownEvent } from './events';
import { normalizeVideoUrl } from './link';
import type { VideoSettings } from './settings';

/* docs/03 section 8, docs/04 section 7: a member with an active membership adds a link; it waits for
 * a moderator (7.2) and earns nothing yet. The user row is locked, so the monthly limit holds under
 * simultaneous submits. */

export type AddVideoRefusal =
	'not_found' | 'no_membership' | 'platform' | 'duplicate' | 'limit' | 'event';
export type AddVideoResult = { ok: true; id: string } | { ok: false; reason: AddVideoRefusal };

const refuse = (reason: AddVideoRefusal) => ({ ok: false, reason }) as const;

const monthStart = (now: Date) => startOfYerevanDay(`${yerevanDay(now).slice(0, 8)}01`);

export async function addVideo(
	db: LimitDb,
	userId: string,
	input: VideoForm,
	settings: VideoSettings,
	now = new Date()
): Promise<AddVideoResult> {
	if (!isUuid(userId)) return refuse('not_found');
	const link = normalizeVideoUrl(input.url, settings.platforms);
	if (!link) return refuse('platform');
	if (input.eventId !== null && !isUuid(input.eventId)) return refuse('event');
	return db.transaction(async (tx) => {
		const [user] = await tx
			.select({ status: users.status, deletedAt: users.deletedAt })
			.from(users)
			.where(eq(users.id, userId))
			.for('update');
		if (!user || user.deletedAt || user.status !== 'active') return refuse('not_found');
		if (!(await getMembershipOverview(tx, userId, now)).active) return refuse('no_membership');
		if (input.eventId !== null) {
			const [event] = await tx
				.select({ id: events.id })
				.from(events)
				.where(and(eq(events.id, input.eventId), startedShownEvent(now)));
			if (!event) return refuse('event');
		}
		const own = eq(videos.userId, userId);
		const [same] = await tx
			.select({ id: videos.id })
			.from(videos)
			.where(and(own, eq(videos.url, link.url)));
		if (same) return refuse('duplicate');
		const [{ added }] = await tx
			.select({ added: count() })
			.from(videos)
			.where(and(own, gte(videos.createdAt, monthStart(now))));
		if (added >= settings.monthlyLimit) return refuse('limit');
		const [row] = await tx
			.insert(videos)
			.values({ userId, ...link, title: input.title, eventId: input.eventId, createdAt: now })
			.returning({ id: videos.id });
		return { ok: true as const, id: row.id };
	});
}
