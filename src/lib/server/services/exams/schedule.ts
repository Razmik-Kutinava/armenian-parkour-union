import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { exams } from '../../db/schema/certification';
import { examKind } from '../../db/schema/enums';
import { writeAudit } from '../audit';
import type { Actor } from '../users/target';
import { checkExamAdmission, type ExamKind, type ExamRefusal, type ExamWarning } from './admission';
import { eventExists, examinerValid, lockExamMember, readExamFacts } from './facts';
import type { ExamSettings } from './settings';

/* docs/03 section 4.1–4.2, docs/05 section 7: a moderator or an admin schedules an exam; a retake
 * is a new row through the same call. The level is never changed here (docs/03 section 3.5). */

export type ScheduleExamInput = {
	userId: string;
	kind: ExamKind;
	scheduledAt: Date;
	eventId?: string | null;
	/** A moderator or an admin (docs/04 section 2). */
	examinerId?: string | null;
	notes?: string | null;
	/** The staff saw the level warning and schedule anyway (docs/05 section 7). */
	confirmLevel?: boolean;
};

export type ScheduleRefusal =
	| 'not_allowed'
	| 'invalid'
	| 'user_not_found'
	| 'event_not_found'
	| 'examiner_invalid'
	| 'confirm_level'
	| ExamRefusal;

export type ScheduleExamResult =
	| { ok: true; id: string; warnings: ExamWarning[] }
	| { ok: false; reason: ScheduleRefusal; warnings: ExamWarning[] };

export const EXAM_NOTES_MAX = 2000;

const refuse = (reason: ScheduleRefusal, warnings: ExamWarning[] = []): ScheduleExamResult => ({
	ok: false,
	reason,
	warnings
});

function parseInput(input: ScheduleExamInput): { notes: string | null } | null {
	if (!examKind.enumValues.includes(input.kind)) return null;
	if (!(input.scheduledAt instanceof Date) || Number.isNaN(input.scheduledAt.getTime()))
		return null;
	const notes = input.notes?.trim() || null;
	return notes && notes.length > EXAM_NOTES_MAX ? null : { notes };
}

export async function scheduleExam(
	db: LimitDb,
	actor: Actor,
	input: ScheduleExamInput,
	deps: { settings: ExamSettings },
	ip: string | null,
	now = new Date()
): Promise<ScheduleExamResult> {
	if (!roleCan(actor.role, 'exams.manage')) return refuse('not_allowed');
	const parsed = parseInput(input);
	if (!parsed) return refuse('invalid');
	const eventId = input.eventId || null;
	const examinerId = input.examinerId || null;
	return db.transaction(async (tx) => {
		const member = await lockExamMember(tx, input.userId);
		if (!member) return refuse('user_not_found');
		if (eventId && !(await eventExists(tx, eventId))) return refuse('event_not_found');
		if (examinerId && !(await examinerValid(tx, examinerId))) return refuse('examiner_invalid');
		const facts = await readExamFacts(
			tx,
			input.userId,
			input.kind,
			member.level,
			deps.settings,
			now
		);
		const { refusal, warnings } = checkExamAdmission({
			at: input.scheduledAt,
			kind: input.kind,
			user: member,
			settings: deps.settings,
			...facts
		});
		if (refusal) return refuse(refusal, warnings);
		if (warnings.length && !input.confirmLevel) return refuse('confirm_level', warnings);
		const [row] = await tx
			.insert(exams)
			.values({
				userId: input.userId,
				kind: input.kind,
				eventId,
				scheduledAt: input.scheduledAt,
				examinerId,
				notes: parsed.notes
			})
			.returning({ id: exams.id });
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'exam.schedule',
			entityType: 'exam',
			entityId: row.id,
			after: {
				userId: input.userId,
				kind: input.kind,
				scheduledAt: input.scheduledAt.toISOString(),
				eventId,
				examinerId,
				warnings
			},
			ip
		});
		return { ok: true as const, id: row.id, warnings };
	});
}
