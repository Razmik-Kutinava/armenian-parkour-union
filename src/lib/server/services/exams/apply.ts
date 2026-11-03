import { and, eq } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { examApplications, exams } from '../../db/schema/certification';
import { users } from '../../db/schema/users';
import type { Mail } from '../../mail/resend';
import { federationEmail } from '../training/access-facts';
import { isUuid } from '../users/target';
import { checkExamAdmission, type ExamKind, type ExamRefusal } from './admission';
import { applicationRequestLetter, type ApplicationMember } from './application-mail';
import { lockExamMember, readExamFacts } from './facts';
import type { ExamSettings } from './settings';

/* Cabinet request for the next level exam (docs/04 § 7; decisions — docs/todo.md). */

export type ApplyExamDeps = {
	send: (mail: Mail) => Promise<void>;
	siteUrl: string | undefined;
	ip: string | null;
	settings: ExamSettings;
	now?: Date;
};

export type ApplyExamRefusal =
	ExamRefusal | 'not_found' | 'bad_state' | 'no_exam' | 'level_mismatch';
export type ApplyExamResult = { ok: true; id: string } | { ok: false; reason: ApplyExamRefusal };

const NEXT: Record<string, ExamKind | null> = {
	novice: 'level_advanced',
	advanced: 'level_pro',
	pro: null
};

const refuse = (reason: ApplyExamRefusal): ApplyFail => ({ ok: false, reason });
const isDuplicate = (e: unknown) =>
	[e, (e as { cause?: unknown })?.cause].some((x) => (x as { code?: string })?.code === '23505');

function canReapply(
	status: 'pending' | 'approved' | 'rejected',
	examResult: 'scheduled' | 'passed' | 'failed' | 'cancelled' | null
) {
	if (status === 'rejected') return true;
	if (status === 'pending') return false;
	return examResult === 'failed' || examResult === 'cancelled';
}

async function contactOf(tx: LimitDb, userId: string): Promise<ApplicationMember> {
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
	return row;
}

type ApplyOk = { ok: true; id: string; member: ApplicationMember; kind: ExamKind };
type ApplyFail = { ok: false; reason: ApplyExamRefusal };

async function apply(
	db: LimitDb,
	userId: string,
	settings: ExamSettings,
	now: Date
): Promise<ApplyOk | ApplyFail> {
	return db.transaction(async (tx) => {
		const member = await lockExamMember(tx, userId);
		if (!member) return refuse('not_found');
		if (member.status !== 'active') return refuse('blocked');
		const kind = member.level ? NEXT[member.level] : null;
		if (!kind) return refuse('no_exam');

		const [existing] = await tx
			.select({
				id: examApplications.id,
				status: examApplications.status,
				examId: examApplications.examId
			})
			.from(examApplications)
			.where(and(eq(examApplications.userId, userId), eq(examApplications.kind, kind)))
			.for('update');

		let examResult: 'scheduled' | 'passed' | 'failed' | 'cancelled' | null = null;
		if (existing?.examId) {
			const [exam] = await tx
				.select({ result: exams.result })
				.from(exams)
				.where(eq(exams.id, existing.examId));
			examResult = exam?.result ?? null;
		}
		if (existing && !canReapply(existing.status, examResult)) return refuse('bad_state');

		const facts = await readExamFacts(tx, userId, kind, member.level, settings, now);
		const { refusal, warnings } = checkExamAdmission({
			at: now,
			kind,
			user: member,
			settings,
			...facts
		});
		if (refusal) return refuse(refusal);
		if (warnings.includes('level_mismatch')) return refuse('level_mismatch');

		const contact = await contactOf(tx, userId);
		if (existing) {
			await tx
				.update(examApplications)
				.set({
					status: 'pending',
					reviewedBy: null,
					reviewedAt: null,
					reviewNote: null,
					examId: null
				})
				.where(eq(examApplications.id, existing.id));
			return { ok: true as const, id: existing.id, member: contact, kind };
		}
		const [row] = await tx
			.insert(examApplications)
			.values({ userId, kind })
			.returning({ id: examApplications.id });
		return { ok: true as const, id: row.id, member: contact, kind };
	});
}

export async function applyForExam(
	db: LimitDb,
	userId: string,
	deps: ApplyExamDeps,
	now = deps.now ?? new Date()
): Promise<ApplyExamResult> {
	if (!isUuid(userId)) return refuse('not_found');
	const outcome: ApplyOk | ApplyFail = await apply(db, userId, deps.settings, now).catch(
		(e): ApplyFail => {
			if (isDuplicate(e)) return { ok: false, reason: 'bad_state' };
			throw e;
		}
	);
	if (!outcome.ok) return outcome;
	const to = await federationEmail(db);
	if (!to) console.warn(`exam application ${outcome.id}: no federation email, letter not sent`);
	else {
		const letter = applicationRequestLetter(to, outcome.member, outcome.kind, deps.siteUrl);
		await deps.send(letter).catch((e) => console.warn(`exam application ${outcome.id}: letter`, e));
	}
	return { ok: true, id: outcome.id };
}
