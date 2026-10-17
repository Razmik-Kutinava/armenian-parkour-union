import type { HeroValues } from '#lib/validation/hero.ts';
import type { LimitDb } from '../../auth/rate-limit';
import type { UserRole } from '../../auth/session';
import { events } from '../../db/schema/events';
import { heroBlocks } from '../../db/schema/hero';
import { media, siteSettings } from '../../db/schema/service';
import { insertUser } from '../../db/test-db';
import { createHeroBlock } from './edit';

/* Test support only: hero service tests run inside a rolled-back transaction. */

export const IP = '198.51.100.9';
export const DAY = 86_400_000;

export const heroValues = (extra: Partial<HeroValues> = {}): HeroValues => ({
	type: 'custom',
	title: { en: 'Hero' },
	subtitle: {},
	mediaKey: null,
	videoUrl: null,
	ctaLabel: null,
	ctaUrl: null,
	eventId: null,
	personUserId: null,
	startsAt: null,
	endsAt: null,
	isActive: false,
	...extra
});

export const staff = async (tx: LimitDb, role: UserRole = 'editor') => ({
	id: (await insertUser(tx, { role })).id,
	role
});

/** The dev database holds blocks of other runs: each test starts from an empty table. */
export async function clearHero(tx: LimitDb) {
	await tx.delete(heroBlocks);
}

export async function setHeroLimit(tx: LimitDb, limit: number) {
	await tx
		.insert(siteSettings)
		.values({ key: 'hero_max_active', value: limit })
		.onConflictDoUpdate({ target: siteSettings.key, set: { value: limit } });
}

export async function createdHero(
	tx: LimitDb,
	actor: { id: string; role: UserRole },
	values: HeroValues
) {
	const result = await createHeroBlock(tx, actor, values, IP);
	if (typeof result === 'string') throw new Error(result);
	return result.id;
}

export async function insertEvent(tx: LimitDb, extra: Partial<typeof events.$inferInsert> = {}) {
	const startsAt = new Date(Date.now() + 5 * DAY);
	const [row] = await tx
		.insert(events)
		.values({
			slug: `t-hero-${crypto.randomUUID().slice(0, 8)}`,
			title: { en: 'Hero event' },
			status: 'published',
			publishedAt: new Date(Date.now() - DAY),
			startsAt,
			endsAt: new Date(startsAt.getTime() + 3_600_000),
			...extra
		})
		.returning({ id: events.id, slug: events.slug });
	return row;
}

export async function insertImage(tx: LimitDb, mime = 'image/png') {
	const owner = await insertUser(tx);
	const key = `media/2026/10/${crypto.randomUUID()}.${mime === 'image/png' ? 'png' : 'pdf'}`;
	await tx
		.insert(media)
		.values({ key, originalName: 'hero', mime, sizeBytes: 10, uploadedBy: owner.id });
	return key;
}

/** `YYYY-MM-DD` of the day `years` years and `days` days ago (UTC). */
export function birthDateAgo(years: number, days = 0) {
	const d = new Date();
	d.setUTCFullYear(d.getUTCFullYear() - years);
	d.setUTCDate(d.getUTCDate() - days);
	return d.toISOString().slice(0, 10);
}
