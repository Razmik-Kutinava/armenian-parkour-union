import { desc, eq } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { videos } from '../../db/schema/videos';
import { isUuid } from '../users/target';

/* docs/06 section 5.7: the member's own videos only; the id comes from the session. The full history
 * (reject reason, points, delete) — 7.7. */

const OWN_LIMIT = 100;

export async function ownVideos(db: LimitDb, userId: string) {
	if (!isUuid(userId)) return [];
	return db
		.select({
			id: videos.id,
			url: videos.url,
			title: videos.title,
			status: videos.status,
			createdAt: videos.createdAt
		})
		.from(videos)
		.where(eq(videos.userId, userId))
		.orderBy(desc(videos.createdAt))
		.limit(OWN_LIMIT);
}
