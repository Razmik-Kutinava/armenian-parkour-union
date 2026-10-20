import { eq } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { pointsRules } from '../../db/schema/points';
import { appendEntry } from './ledger';

/** Rule codes are fixed by docs/02 section 5: each one awards one reason for one kind of source. */
export const RULE_SOURCES = {
	certificate_level_advanced: { reason: 'certificate', sourceType: 'certificate' },
	certificate_level_pro: { reason: 'certificate', sourceType: 'certificate' },
	certificate_trainer: { reason: 'certificate', sourceType: 'certificate' },
	certificate_judge: { reason: 'certificate', sourceType: 'certificate' },
	event_registration: { reason: 'event_registration', sourceType: 'event_registration' },
	event_participation: { reason: 'event_participation', sourceType: 'event_registration' },
	event_place_1: { reason: 'event_place', sourceType: 'event_registration' },
	event_place_2: { reason: 'event_place', sourceType: 'event_registration' },
	event_place_3: { reason: 'event_place', sourceType: 'event_registration' },
	video_approved: { reason: 'video', sourceType: 'video' }
} as const;

export type PointsRuleCode = keyof typeof RULE_SOURCES;
export type AwardInput = { rule: PointsRuleCode; userId: string; sourceId: string };
type SkipReason = 'rule_missing' | 'rule_inactive' | 'no_points' | 'duplicate' | 'no_user';
export type AwardResult =
	| { status: 'awarded'; entryId: string; points: number }
	| { status: 'skipped'; reason: SkipReason };

const skip = (reason: SkipReason): AwardResult => ({ status: 'skipped', reason });

/**
 * docs/03 section 6.2: a system award inside the caller's transaction (certificate, registration,
 * video). The rule's current points are written into the entry; a repeat for the same source is a
 * silent skip. Rules only award: 0 or fewer points writes nothing.
 */
export async function awardPoints(tx: LimitDb, input: AwardInput): Promise<AwardResult> {
	const [rule] = await tx.select().from(pointsRules).where(eq(pointsRules.code, input.rule));
	if (!rule) return skip('rule_missing');
	if (!rule.isActive) return skip('rule_inactive');
	if (rule.points <= 0) return skip('no_points');
	const source = RULE_SOURCES[input.rule];
	const result = await appendEntry(tx, {
		userId: input.userId,
		delta: rule.points,
		reason: source.reason,
		ruleId: rule.id,
		sourceType: source.sourceType,
		sourceId: input.sourceId,
		createdBy: null
	});
	if (result.status === 'ok') {
		return { status: 'awarded', entryId: result.entry.id, points: rule.points };
	}
	if (result.status === 'insufficient_balance')
		throw new Error('a positive award lowered a balance');
	return skip(result.status);
}
