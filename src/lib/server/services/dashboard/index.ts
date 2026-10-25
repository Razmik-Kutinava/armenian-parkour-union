import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import type { Actor } from '../users/target';
import {
	recentUsers,
	shortStats,
	suspiciousWeek,
	type RecentUser,
	type ShortStats,
	type SuspiciousRow
} from './admin';
import { attentionCounts, type AttentionItem } from './attention';
import { heroNow, upcomingEvents, type HeroNow, type UpcomingEvent } from './events';

/* docs/05 section 3: what needs attention, each block only for the role with its right. `null` —
 * the viewer may not see the block. */

export type Dashboard = {
	attention: AttentionItem[];
	upcoming: UpcomingEvent[];
	hero: HeroNow[] | null;
	recentUsers: RecentUser[] | null;
	suspicious: { total: number; rows: SuspiciousRow[]; href: string } | null;
	stats: ShortStats | null;
};

export async function getDashboard(db: LimitDb, viewer: Actor): Promise<Dashboard> {
	const may = (p: Parameters<typeof roleCan>[1]) => roleCan(viewer.role, p);
	return {
		attention: await attentionCounts(db, viewer),
		upcoming: await upcomingEvents(db, viewer),
		hero: may('hero.write') ? await heroNow(db) : null,
		recentUsers: may('users.read_full') ? await recentUsers(db) : null,
		suspicious: may('points.adjust') ? await suspiciousWeek(db) : null,
		stats: may('payments.read') ? await shortStats(db) : null
	};
}

export type { AttentionItem, HeroNow, RecentUser, ShortStats, SuspiciousRow, UpcomingEvent };
