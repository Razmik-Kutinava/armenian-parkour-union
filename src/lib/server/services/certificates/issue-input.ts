import type { certificates, exams } from '../../db/schema/certification';
import type { users } from '../../db/schema/users';
import { isUuid } from '../users/target';
import type { IssueCertificateInput } from './issue-types';
import type { CertificateSettings } from './settings';
import { staffExpiry } from './validity';

/* docs/03 sections 3.1, 4.3–4.8; docs/05 section 8: the form of an issue, which exam opens which
 * certificate, and the level order. */

type Kind = (typeof certificates.$inferSelect)['kind'];
type CertLevel = 'advanced' | 'pro';
type Level = (typeof users.$inferSelect)['level'];

export const CERTIFICATE_COMMENT_MAX = 2000;
export const CERTIFICATE_CATEGORY_MAX = 100;
const KINDS: Kind[] = ['level', 'trainer', 'judge'];
const LEVELS: CertLevel[] = ['advanced', 'pro'];
const EARLIEST = Date.UTC(2000, 0, 1);

export type IssueValues = {
	userId: string;
	kind: Kind;
	level: CertLevel | null;
	category: string | null;
	examId: string | null;
	issuedAt: Date;
	expiresAt: Date | null;
	comment: string | null;
};

export type InputRefusal = 'invalid' | 'expiry_invalid' | 'comment_required';
type Parsed = { ok: true; value: IssueValues } | { ok: false; reason: InputRefusal };

const isDate = (d: unknown): d is Date => d instanceof Date && !Number.isNaN(d.getTime());
const fail = (reason: InputRefusal): Parsed => ({ ok: false, reason });

function shapeOk(i: IssueCertificateInput, category: string | null, comment: string | null) {
	if (!isUuid(i.userId) || !KINDS.includes(i.kind)) return false;
	if (i.examId && !isUuid(i.examId)) return false;
	if (comment && comment.length > CERTIFICATE_COMMENT_MAX) return false;
	if (i.kind === 'level') return LEVELS.includes(i.level!) && !category && !i.expiresAt;
	return !i.level && (!category || category.length <= CERTIFICATE_CATEGORY_MAX);
}

export function parseIssueInput(
	input: IssueCertificateInput,
	settings: CertificateSettings,
	now: Date
): Parsed {
	const category = input.category?.trim() || null;
	const comment = input.comment?.trim() || null;
	if (!shapeOk(input, category, comment)) return fail('invalid');
	const issuedAt = input.issuedAt ?? now;
	if (!isDate(issuedAt) || issuedAt > now || issuedAt.getTime() < EARLIEST) return fail('invalid');
	let expiresAt: Date | null = null;
	if (input.kind !== 'level') {
		expiresAt = input.expiresAt ?? staffExpiry(issuedAt, settings.staffValidMonths);
		if (!isDate(expiresAt) || expiresAt <= now || expiresAt <= issuedAt)
			return fail('expiry_invalid');
	}
	const examId = input.examId || null;
	if (!examId && !comment) return fail('comment_required');
	const level = input.kind === 'level' ? input.level! : null;
	const value = {
		userId: input.userId,
		kind: input.kind,
		level,
		category,
		examId,
		issuedAt,
		expiresAt,
		comment
	};
	return { ok: true, value };
}

const EXAM_FOR: Record<string, (typeof exams.$inferSelect)['kind']> = {
	'level/advanced': 'level_advanced',
	'level/pro': 'level_pro',
	'trainer/': 'trainer',
	'judge/': 'judge'
};

export const examFits = (
	examKind: (typeof exams.$inferSelect)['kind'],
	kind: Kind,
	level: CertLevel | null
) => EXAM_FOR[`${kind}/${level ?? ''}`] === examKind;

const RANK: Record<NonNullable<Level>, number> = { novice: 0, advanced: 1, pro: 2 };

/** docs/03 section 3.1: one step up; the same level keeps it; never down. */
export function levelStep(
	current: Level,
	target: CertLevel
): 'up' | 'same' | 'level_skip' | 'level_below' {
	if (current === null) return 'level_skip';
	const diff = RANK[target] - RANK[current];
	if (diff === 1) return 'up';
	if (diff === 0) return 'same';
	return diff > 1 ? 'level_skip' : 'level_below';
}
