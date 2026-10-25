import { and, asc, count, desc, eq, ilike, isNotNull, isNull, type SQL } from 'drizzle-orm';
import {
	PAGE_SIZE,
	pageOffset,
	type ListOptions,
	type ListState
} from '#lib/components/admin/list-state.ts';
import type { LocalizedText } from '#lib/i18n/localized.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { events } from '../../db/schema/events';
import { users } from '../../db/schema/users';
import { videoPlatforms, videos } from '../../db/schema/videos';

/* docs/05 section 11: the queue — pending by default, oldest on top; filter values are checked before
 * reaching SQL; deleted members are not shown (docs/todo.md 7.2, decision 7). */

export const videoListOptions: ListOptions = {
	sortable: ['createdAt'],
	filters: ['status', 'platform'],
	defaultSort: { key: 'createdAt', dir: 'asc' }
};

export const videoStatusFilters = ['pending', 'approved', 'hidden', 'rejected', 'all'] as const;
export type VideoStatusFilter = (typeof videoStatusFilters)[number];
export type VideoView = 'pending' | 'approved' | 'hidden' | 'rejected';

/** The status filter in effect: missing or unknown — the queue itself. */
export const videoStatusFilter = (state: ListState): VideoStatusFilter =>
	videoStatusFilters.find((s) => s === state.filters.status) ?? 'pending';

export type VideoListRow = {
	id: string;
	userId: string;
	memberName: string;
	url: string;
	platform: (typeof videoPlatforms)[number];
	title: string | null;
	eventTitle: LocalizedText | null;
	status: VideoView;
	rejectReason: string | null;
	createdAt: Date;
};

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

function byStatus(status: VideoStatusFilter): SQL | undefined {
	if (status === 'all') return undefined;
	if (status === 'hidden') return and(eq(videos.status, 'approved'), isNotNull(videos.hiddenAt));
	if (status === 'approved') return and(eq(videos.status, 'approved'), isNull(videos.hiddenAt));
	return eq(videos.status, status);
}

function conditions(state: ListState): SQL | undefined {
	const platform = videoPlatforms.find((p) => p === state.filters.platform);
	return and(
		isNull(users.deletedAt),
		state.q ? ilike(users.name, `%${escapeLike(state.q)}%`) : undefined,
		platform ? eq(videos.platform, platform) : undefined,
		byStatus(videoStatusFilter(state))
	);
}

export async function listVideos(
	db: LimitDb,
	state: ListState
): Promise<{ rows: VideoListRow[]; total: number }> {
	const where = conditions(state);
	const order = state.dir === 'desc' ? desc(videos.createdAt) : asc(videos.createdAt);
	const rows = await db
		.select({
			id: videos.id,
			userId: videos.userId,
			memberName: users.name,
			url: videos.url,
			platform: videos.platform,
			title: videos.title,
			eventTitle: events.title,
			status: videos.status,
			hiddenAt: videos.hiddenAt,
			rejectReason: videos.rejectReason,
			createdAt: videos.createdAt
		})
		.from(videos)
		.innerJoin(users, eq(users.id, videos.userId))
		.leftJoin(events, eq(events.id, videos.eventId))
		.where(where)
		.orderBy(order, asc(videos.id))
		.limit(PAGE_SIZE)
		.offset(pageOffset(state.page));
	const [{ total }] = await db
		.select({ total: count() })
		.from(videos)
		.innerJoin(users, eq(users.id, videos.userId))
		.where(where);
	return {
		rows: rows.map(({ hiddenAt, ...r }) => ({
			...r,
			eventTitle: (r.eventTitle as LocalizedText | null) ?? null,
			status: hiddenAt ? 'hidden' : r.status
		})),
		total
	};
}
