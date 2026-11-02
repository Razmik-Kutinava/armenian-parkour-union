import { eq } from 'drizzle-orm';
import { isLocale, localizePath, type Locale } from '#lib/i18n/locales.ts';
import { translate } from '#lib/i18n/translate.ts';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { users } from '../../db/schema/users';
import { volunteerCards } from '../../db/schema/volunteer-cards';
import type { Mail } from '../../mail/resend';
import { writeAudit } from '../audit';
import { isUuid, type Actor } from '../users/target';
import type { CardRecipient } from './card-mail';
import { volunteerSettings } from './settings';

/* docs/03 section 19.6: streak bumps, flag + warning letter once, admin clear. */

export type StreakLetter = Mail | null;

const fullName = (m: CardRecipient) =>
	[m.firstName, m.lastName].filter(Boolean).join(' ') || m.name;

export function declineWarningLetter(
	member: CardRecipient,
	streak: number,
	siteUrl?: string
): Mail {
	const locale: Locale = isLocale(member.locale) ? member.locale : 'en';
	const params = {
		name: member.firstName ?? fullName(member),
		n: String(streak),
		url: `${siteUrl ?? ''}${localizePath('/cabinet/volunteer', locale)}`
	};
	return {
		to: member.email,
		subject: translate(locale, 'volunteerCards.mail.flag.subject'),
		text: translate(locale, 'volunteerCards.mail.flag.text', params)
	};
}

async function lockCard(tx: LimitDb, userId: string) {
	const [card] = await tx
		.select()
		.from(volunteerCards)
		.where(eq(volunteerCards.userId, userId))
		.for('update');
	return card ?? null;
}

async function memberOf(tx: LimitDb, userId: string): Promise<CardRecipient | null> {
	const [row] = await tx
		.select({
			email: users.email,
			locale: users.locale,
			firstName: users.firstName,
			lastName: users.lastName,
			name: users.name
		})
		.from(users)
		.where(eq(users.id, userId));
	return row ?? null;
}

/** +delta to streak; at threshold sets flagged_at once and returns a warning letter. */
export async function bumpDeclineStreak(
	tx: LimitDb,
	userId: string,
	delta: number,
	now: Date,
	siteUrl?: string
): Promise<StreakLetter> {
	if (delta <= 0) return null;
	const card = await lockCard(tx, userId);
	if (!card) return null;
	const { declineThreshold } = await volunteerSettings(tx);
	const streak = card.declineStreak + delta;
	const flagNow = streak >= declineThreshold && card.flaggedAt === null;
	await tx
		.update(volunteerCards)
		.set({
			declineStreak: streak,
			...(flagNow ? { flaggedAt: now } : {})
		})
		.where(eq(volunteerCards.id, card.id));
	if (!flagNow) return null;
	const member = await memberOf(tx, userId);
	return member ? declineWarningLetter(member, streak, siteUrl) : null;
}

/** Attended: streak 0 and clear the flag (docs/03 section 19.6 p. 4). */
export async function resetDeclineStreak(tx: LimitDb, userId: string) {
	const card = await lockCard(tx, userId);
	if (!card) return;
	if (card.declineStreak === 0 && card.flaggedAt === null) return;
	await tx
		.update(volunteerCards)
		.set({ declineStreak: 0, flaggedAt: null })
		.where(eq(volunteerCards.id, card.id));
}

export async function clearCardFlag(
	db: LimitDb,
	actor: Actor,
	cardId: string,
	ip: string | null
): Promise<{ ok: true } | { ok: false; reason: 'not_allowed' | 'not_found' | 'bad_state' }> {
	if (!roleCan(actor.role, 'volunteer.manage')) return { ok: false, reason: 'not_allowed' };
	if (!isUuid(cardId)) return { ok: false, reason: 'not_found' };
	return db.transaction(async (tx) => {
		const [row] = await tx
			.select()
			.from(volunteerCards)
			.where(eq(volunteerCards.id, cardId))
			.for('update');
		if (!row) return { ok: false, reason: 'not_found' as const };
		if (row.flaggedAt === null) return { ok: false, reason: 'bad_state' as const };
		await tx
			.update(volunteerCards)
			.set({ declineStreak: 0, flaggedAt: null })
			.where(eq(volunteerCards.id, cardId));
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'volunteer_card.unflag',
			entityType: 'volunteer_card',
			entityId: cardId,
			before: { declineStreak: row.declineStreak, flagged: true },
			after: { declineStreak: 0, flagged: false, userId: row.userId },
			ip
		});
		return { ok: true as const };
	});
}
