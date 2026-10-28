import { and, count, eq, gte, isNull, sql, type SQL } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { roleCan, type Permission } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { consents } from '../../db/schema/consents';
import { events } from '../../db/schema/events';
import { payments } from '../../db/schema/payments';
import { eventRegistrations } from '../../db/schema/registrations';
import { shopOrders } from '../../db/schema/shop';
import { courseAccess, practiceSubmissions } from '../../db/schema/training-progress';
import { videos } from '../../db/schema/videos';
import { awaitingCertificateCount } from '../exams/awaiting';
import type { Actor } from '../users/target';

/* docs/05 section 3 "Needs action": a counter only for a role with the right to its section
 * (docs/04 section 5.1). A failed payment is an abandoned checkout, not a task: only "needs review". */

export type AttentionKey =
	| 'videos'
	| 'consents'
	| 'orders'
	| 'payments'
	| 'waitlist'
	| 'training_requests'
	| 'practice'
	| 'training_finished';
export type AttentionItem = { key: AttentionKey; count: number; href: string };

type Counter = {
	key: AttentionKey;
	permission: Permission;
	href: string;
	count: (db: LimitDb) => Promise<number>;
};

const countOf = async (db: LimitDb, table: PgTable, where: SQL | undefined) =>
	(await db.select({ n: count() }).from(table).where(where))[0].n;

const waitlist = async (db: LimitDb) =>
	(
		await db
			.select({ n: count() })
			.from(eventRegistrations)
			.innerJoin(events, eq(events.id, eventRegistrations.eventId))
			.where(
				and(
					eq(eventRegistrations.status, 'waitlist'),
					eq(events.status, 'published'),
					isNull(events.deletedAt),
					gte(events.endsAt, sql`now()`)
				)
			)
	)[0].n;

const COUNTERS: Counter[] = [
	{
		key: 'videos',
		permission: 'videos.moderate',
		href: '/admin/videos',
		count: (db) => countOf(db, videos, eq(videos.status, 'pending'))
	},
	{
		key: 'consents',
		permission: 'consents.review',
		href: '/admin/consents?status=pending',
		count: (db) => countOf(db, consents, eq(consents.status, 'pending'))
	},
	{
		key: 'orders',
		permission: 'shop.orders_manage',
		href: '/admin/orders?status=new',
		count: (db) => countOf(db, shopOrders, eq(shopOrders.status, 'new'))
	},
	{
		key: 'payments',
		permission: 'payments.read',
		href: '/admin/payments?review=1',
		count: (db) => countOf(db, payments, eq(payments.needsReview, true))
	},
	{
		key: 'waitlist',
		permission: 'registrations.read',
		href: '/admin/registrations?period=upcoming',
		count: waitlist
	},
	{
		key: 'training_requests',
		permission: 'training.manage',
		href: '/admin/training/access',
		count: (db) => countOf(db, courseAccess, eq(courseAccess.status, 'pending'))
	},
	{
		key: 'practice',
		permission: 'training.review',
		href: '/admin/training/practice',
		count: (db) => countOf(db, practiceSubmissions, eq(practiceSubmissions.status, 'pending'))
	},
	{
		key: 'training_finished',
		permission: 'certificates.issue',
		href: '/admin/exams?certificate=course',
		count: awaitingCertificateCount
	}
];

export async function attentionCounts(db: LimitDb, viewer: Actor): Promise<AttentionItem[]> {
	const allowed = COUNTERS.filter((c) => roleCan(viewer.role, c.permission));
	const items: AttentionItem[] = [];
	for (const c of allowed) items.push({ key: c.key, count: await c.count(db), href: c.href });
	return items;
}
