import { and, desc, eq, gte, isNull, or, sql } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { events } from '../../db/schema/events';
import type { LocalizedText } from '#lib/i18n/localized.ts';

export type HeroEventChoice = { id: string; title: LocalizedText; status: string };

/** Events for an event block: not deleted and not over, plus the one already chosen. */
export async function listHeroEventChoices(
	db: LimitDb,
	chosenId: string | null = null
): Promise<HeroEventChoice[]> {
	const rows = await db
		.select({ id: events.id, title: events.title, status: events.status })
		.from(events)
		.where(
			or(
				and(isNull(events.deletedAt), gte(events.endsAt, sql`now()`)),
				chosenId ? eq(events.id, chosenId) : undefined
			)
		)
		.orderBy(desc(events.startsAt), desc(events.id))
		.limit(200);
	return rows.map((r) => ({ ...r, title: r.title as LocalizedText }));
}
