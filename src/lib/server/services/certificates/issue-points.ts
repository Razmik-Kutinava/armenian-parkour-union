import type { LimitDb } from '../../auth/rate-limit';
import { awardPoints, type PointsRuleCode } from '../points/award';
import { certificatePointsStand } from './issue-facts';
import type { IssueValues } from './issue-input';

/* docs/03 section 6.1: each certificate kind has its rule; sourced by the certificate id. */

const RULES: Record<string, PointsRuleCode> = {
	'level/advanced': 'certificate_level_advanced',
	'level/pro': 'certificate_level_pro',
	'trainer/': 'certificate_trainer',
	'judge/': 'certificate_judge'
};

export type CertificatePoints =
	{ awarded: number; skipped?: undefined } | { awarded: null; skipped: string };

/** A re-issue of the same kind and level pays nothing while the earlier award stands. */
export async function awardCertificatePoints(
	tx: LimitDb,
	v: IssueValues,
	certificateId: string
): Promise<CertificatePoints> {
	if (await certificatePointsStand(tx, v)) return { awarded: null, skipped: 'already_awarded' };
	const rule = RULES[`${v.kind}/${v.level ?? ''}`];
	const result = await awardPoints(tx, { rule, userId: v.userId, sourceId: certificateId });
	return result.status === 'awarded'
		? { awarded: result.points }
		: { awarded: null, skipped: result.reason };
}
