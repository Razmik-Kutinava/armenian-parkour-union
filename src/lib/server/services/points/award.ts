import type { LimitDb } from '../../auth/rate-limit';

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
export type AwardResult =
	| { status: 'awarded'; entryId: string; points: number }
	| {
			status: 'skipped';
			reason: 'rule_missing' | 'rule_inactive' | 'no_points' | 'duplicate' | 'no_user';
	  };

export async function awardPoints(tx: LimitDb, input: AwardInput): Promise<AwardResult> {
	void tx;
	void input;
	throw new Error('not implemented');
}
