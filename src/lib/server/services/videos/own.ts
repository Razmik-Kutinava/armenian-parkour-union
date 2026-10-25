import { and, desc, eq, sql } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { pointsLedger } from '../../db/schema/points';
import { videos } from '../../db/schema/videos';
import { isUuid } from '../users/target';

/* docs/06 section 5.7: the member's own videos only; the id comes from the session. Decisions —
 * docs/todo.md 7.7 (1, 2). */

const OWN_LIMIT = 100;
const DELETABLE: readonly string[] = ['pending', 'rejected'];

/** `points` — the net of the video's ledger entries (a reversal copies the source); none — `null`. */
export async function ownVideos(db: LimitDb, userId: string) {
	if (!isUuid(userId)) return [];
	const points = db
		.select({
			sourceId: pointsLedger.sourceId,
			total: sql<number>`sum(${pointsLedger.delta})::int`.as('total')
		})
		.from(pointsLedger)
		.where(and(eq(pointsLedger.userId, userId), eq(pointsLedger.sourceType, 'video')))
		.groupBy(pointsLedger.sourceId)
		.as('points');
	return db
		.select({
			id: videos.id,
			url: videos.url,
			title: videos.title,
			status: videos.status,
			rejectReason: videos.rejectReason,
			points: points.total,
			createdAt: videos.createdAt
		})
		.from(videos)
		.leftJoin(points, eq(points.sourceId, videos.id))
		.where(eq(videos.userId, userId))
		.orderBy(desc(videos.createdAt))
		.limit(OWN_LIMIT);
}

/** Hard delete (decisions.md 2026-10-24) of the member's own video until it is approved. */
export async function deleteOwnVideo(
	db: LimitDb,
	userId: string,
	id: string
): Promise<'ok' | 'not_found' | 'not_allowed'> {
	if (!isUuid(userId) || !isUuid(id)) return 'not_found';
	return db.transaction(async (tx) => {
		const [video] = await tx
			.select({ status: videos.status })
			.from(videos)
			.where(and(eq(videos.id, id), eq(videos.userId, userId)))
			.for('update');
		if (!video) return 'not_found' as const;
		if (!DELETABLE.includes(video.status)) return 'not_allowed' as const;
		await tx.delete(videos).where(eq(videos.id, id));
		return 'ok' as const;
	});
}
