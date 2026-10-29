import { and, eq, isNull } from 'drizzle-orm';
import type { Locale } from '#lib/i18n/locales.ts';
import { consume, limits, type LimitDb } from '../../auth/rate-limit';
import { users } from '../../db/schema/users';
import { volunteerCards } from '../../db/schema/volunteer-cards';
import { holderName } from '../certificates/pdf-content';
import { isUuid } from '../users/target';
import { cardPdfContent } from './card-pdf-content';
import { loadCardImages, type ImageFetch } from './card-pdf-images';
import { renderCardPdf } from './card-pdf-render';
import { cardCheckUrl, cardValidity } from './card-rules';
import { paidUntilSql, privacySql } from './card-sql';
import { visiblePartners, type VisiblePartner } from './perks-visible';

/* docs/03 sections 19.2 p. 3, 19.8; decisions — docs/todo.md 10.4 (1–3, 7). Drawn on each request,
 * never stored; a valid card only, for anyone who may download it (the route decides who). */

export type CardPdfTarget = { userId: string } | { cardId: string };
export type CardPdfData = {
	number: string;
	holder: string;
	avatarKey: string | null;
	validUntil: Date;
	checkUrl: string;
	asOf: Date;
	partners: VisiblePartner[];
};

export async function cardPdfData(
	db: LimitDb,
	target: CardPdfTarget,
	siteUrl: string,
	now = new Date()
): Promise<CardPdfData | null> {
	const byUser = 'userId' in target;
	const id = byUser ? target.userId : target.cardId;
	if (!isUuid(id)) return null;
	const [row] = await db
		.select({
			card: volunteerCards,
			member: {
				name: users.name,
				firstName: users.firstName,
				lastName: users.lastName,
				avatarKey: users.avatarKey,
				birthDate: users.birthDate,
				status: users.status
			},
			paidUntil: paidUntilSql(now),
			privacy: privacySql(now)
		})
		.from(volunteerCards)
		.innerJoin(users, eq(users.id, volunteerCards.userId))
		.where(
			and(
				byUser ? eq(volunteerCards.userId, id) : eq(volunteerCards.id, id),
				isNull(users.deletedAt)
			)
		);
	if (!row) return null;
	const { card, member, paidUntil, privacy } = row;
	if (!card.number || !card.publicToken) return null;
	const facts = { birthDate: member.birthDate, status: member.status, paidUntil, privacy };
	const validity = cardValidity(card.status, facts, now);
	if (!validity.valid) return null;
	return {
		number: card.number,
		holder: holderName(member),
		avatarKey: member.avatarKey,
		validUntil: validity.until,
		checkUrl: cardCheckUrl(siteUrl, card.publicToken),
		asOf: now,
		partners: await visiblePartners(db, card.id, now)
	};
}

export type CardPdfDeps = {
	/** Who downloads: the hourly limit is theirs. */
	actorId: string;
	locale: Locale;
	siteUrl: string;
	/** The public address of a stored key; `null` — the bucket is not connected. */
	toUrl: (key: string) => string | null;
	fetch?: ImageFetch;
	now?: Date;
};
export type CardPdfFile =
	| { ok: true; number: string; bytes: Uint8Array<ArrayBuffer> }
	| { ok: false; reason: 'limited' | 'not_found' };

export async function cardPdfFile(
	db: LimitDb,
	target: CardPdfTarget,
	deps: CardPdfDeps
): Promise<CardPdfFile> {
	const key = `volunteer-pdf:user:${deps.actorId}`;
	if (!(await consume(db, key, limits.volunteerPdfPerUser)))
		return { ok: false, reason: 'limited' };
	const data = await cardPdfData(db, target, deps.siteUrl, deps.now);
	if (!data) return { ok: false, reason: 'not_found' };
	const content = cardPdfContent(data, deps.locale);
	const logoKeys = content.partners.map((p) => p.logoKey);
	const images = await loadCardImages(
		{ avatarKey: data.avatarKey, logoKeys },
		deps.toUrl,
		deps.fetch
	);
	return { ok: true, number: data.number, bytes: await renderCardPdf(content, images) };
}
