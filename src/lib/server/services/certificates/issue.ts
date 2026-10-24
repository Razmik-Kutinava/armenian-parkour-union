import { eq } from 'drizzle-orm';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { certificates } from '../../db/schema/certification';
import { users } from '../../db/schema/users';
import type { Mail } from '../../mail/resend';
import { lockExamMember } from '../exams/facts';
import { recipientOf } from '../registrations/recipient';
import type { Actor } from '../users/target';
import { logIssue, logLevelChange } from './issue-audit';
import { checkExam, liveCertificateExists } from './issue-facts';
import { levelStep, parseIssueInput } from './issue-input';
import { awardCertificatePoints } from './issue-points';
import type {
	IssueCertificateInput,
	IssueCertificateResult,
	IssueDeps,
	IssueRefusal
} from './issue-types';
import { issuedLetter, sendCertificateLetter } from './mail';
import { newPublicToken, nextCertificateNumber } from './number';

/* docs/03 section 4.3: one transaction — certificate, level, points, audit; the letter after the
 * commit (section 14). Locks: member row → exam row → number. docs/04 section 8: admin only. */

export type * from './issue-types';

const refuse = (reason: IssueRefusal) => ({ ok: false, reason }) as const;

/** Only the "one live certificate" indexes of 6.1 mean a double issue; anything else is a bug. */
const LIVE_KEYS = ['certificates_exam_id_live_key', 'certificates_user_id_level_live_key'];
const isDoubleIssue = (e: unknown) =>
	[e, (e as { cause?: unknown })?.cause].some((x) => {
		const pg = x as { code?: string; constraint_name?: string } | undefined;
		return pg?.code === '23505' && LIVE_KEYS.includes(pg.constraint_name ?? '');
	});

export async function issueCertificate(
	db: LimitDb,
	actor: Actor,
	input: IssueCertificateInput,
	deps: IssueDeps,
	ip: string | null,
	now = new Date()
): Promise<IssueCertificateResult> {
	if (!roleCan(actor.role, 'certificates.issue')) return refuse('not_allowed');
	const parsed = parseIssueInput(input, deps.settings, now);
	if (!parsed.ok) return refuse(parsed.reason);
	const v = parsed.value;
	const letters: Mail[] = [];
	try {
		const result = await db.transaction(async (tx): Promise<IssueCertificateResult> => {
			const member = await lockExamMember(tx, v.userId);
			if (!member) return refuse('user_not_found');
			if (member.status !== 'active') return refuse('blocked');
			const examRefusal = await checkExam(tx, v);
			if (examRefusal) return refuse(examRefusal);
			const step = v.level ? levelStep(member.level, v.level) : 'same';
			if (step === 'level_skip' || step === 'level_below') return refuse(step);
			if (await liveCertificateExists(tx, v)) return refuse('already_issued');

			const [row] = await tx
				.insert(certificates)
				.values({
					...v,
					number: await nextCertificateNumber(tx, v.issuedAt),
					publicToken: newPublicToken(),
					status: 'active',
					issuedBy: actor.id
				})
				.returning();
			const context = { actor, ip, certificateId: row.id };
			const levelAfter = step === 'up' ? v.level : member.level;
			if (step === 'up') {
				await tx.update(users).set({ level: levelAfter }).where(eq(users.id, v.userId));
				await logLevelChange(tx, context, v.userId, member.level, levelAfter);
			}
			const points = await awardCertificatePoints(tx, v, row.id);
			const facts = { number: row.number, levelBefore: member.level, levelAfter, points };
			await logIssue(tx, context, v, facts);
			const to = deps.send ? await recipientOf(tx, v.userId) : null;
			if (to)
				letters.push(issuedLetter(to, { ...row, kind: v.kind, level: v.level }, deps.siteUrl));
			const { id, number, publicToken } = row;
			return {
				ok: true,
				id,
				number,
				publicToken,
				levelChanged: step === 'up',
				points: points.awarded
			};
		});
		if (deps.send) for (const mail of letters) await sendCertificateLetter(deps.send, mail);
		return result;
	} catch (e) {
		if (isDoubleIssue(e)) return refuse('already_issued');
		throw e;
	}
}
