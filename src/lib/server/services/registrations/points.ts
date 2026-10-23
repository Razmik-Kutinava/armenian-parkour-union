import { and, eq, isNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { pickLocalized, type LocalizedText } from '#lib/i18n/localized.ts';
import { isLocale, type Locale } from '#lib/i18n/locales.ts';
import { translate } from '#lib/i18n/translate.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { pointsLedger } from '../../db/schema/points';
import { users } from '../../db/schema/users';
import { awardPoints, type AwardResult, type PointsRuleCode } from '../points/award';
import { appendEntry } from '../points/ledger';
import type { RegistrationStatus } from './admission';

/* docs/03 sections 6.1-6.2, 7.6-7.7: event points go through the points service inside the
 * registration's transaction. The registration is the source, so each rule pays it once: a member
 * who cancelled and registered again gets no second registration award. */

type Ref = { id: string; userId: string };
type EventRef = { title: unknown; startsAt: Date };

const PLACE_RULES: Partial<Record<number, PointsRuleCode>> = {
	1: 'event_place_1',
	2: 'event_place_2',
	3: 'event_place_3'
};

/** 6.2 p. 5: a registration made on the site became active (`registered`). */
export function awardRegistration(tx: LimitDb, registration: Ref): Promise<AwardResult> {
	const { id: sourceId, userId } = registration;
	return awardPoints(tx, { rule: 'event_registration', userId, sourceId });
}

const reversal = alias(pointsLedger, 'reversal');

async function openAward(tx: LimitDb, registration: Ref) {
	const [award] = await tx
		.select({ id: pointsLedger.id, delta: pointsLedger.delta, locale: users.locale })
		.from(pointsLedger)
		.innerJoin(users, eq(users.id, pointsLedger.userId))
		.leftJoin(reversal, eq(reversal.reversalOfId, pointsLedger.id))
		.where(
			and(
				eq(pointsLedger.userId, registration.userId),
				eq(pointsLedger.reason, 'event_registration'),
				eq(pointsLedger.sourceType, 'event_registration'),
				eq(pointsLedger.sourceId, registration.id),
				isNull(reversal.id)
			)
		);
	return award;
}

/**
 * 6.2 p. 6: cancelled before the start — the registration points go back by a system reversal,
 * commented in the member's language. Points already spent: nothing is written (the balance never
 * goes below zero, 6.3 p. 4), only a warning; the cancel itself goes on.
 */
export async function takeBackRegistration(
	tx: LimitDb,
	registration: Ref,
	event: EventRef,
	now = new Date()
) {
	if (now >= event.startsAt) return;
	const award = await openAward(tx, registration);
	if (!award) return;
	const locale: Locale = isLocale(award.locale) ? award.locale : 'en';
	const title = pickLocalized(event.title as LocalizedText, locale);
	const result = await appendEntry(tx, {
		userId: registration.userId,
		delta: -award.delta,
		reason: 'reversal',
		sourceType: 'event_registration',
		sourceId: registration.id,
		comment: translate(locale, 'registrations.points.cancelled', { event: title }),
		reversalOfId: award.id,
		createdBy: null
	});
	if (result.status === 'insufficient_balance') {
		console.warn(`registration ${registration.id}: points not taken back, the balance is lower`);
	}
}

/**
 * 7.6-7.7, for the results admin (5.7): "attended" earns participation, a place 1-3 adds its own
 * points. A place changed after the award is corrected by hand.
 */
export async function awardEventResult(
	tx: LimitDb,
	registration: Ref & { status: RegistrationStatus; place: number | null }
): Promise<AwardResult[]> {
	if (registration.status !== 'attended') return [];
	const rules: PointsRuleCode[] = ['event_participation'];
	const place = registration.place === null ? undefined : PLACE_RULES[registration.place];
	if (place) rules.push(place);
	const { id: sourceId, userId } = registration;
	const results: AwardResult[] = [];
	for (const rule of rules) results.push(await awardPoints(tx, { rule, userId, sourceId }));
	return results;
}
