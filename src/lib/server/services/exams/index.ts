import type { LimitDb } from '../../auth/rate-limit';
import type { Actor } from '../users/target';
import { scheduleExam, type ScheduleExamInput, type ScheduleExamResult } from './schedule';
import { examSettings } from './settings';

/* docs/05 section 7: routes call these; settings come from `site_settings.exams`. */

export { checkExamAdmission, type ExamKind, type ExamRefusal, type ExamWarning } from './admission';
export {
	examEventOptions,
	examinerOptions,
	examMember,
	getExamCard,
	type ExamCard,
	type ExamEventOption,
	type ExamMember
} from './card';
export { examListOptions, listExams, type ExamListRow } from './list';
export { recordExamResult, type ExamResultInput, type ExamResultOutcome } from './result';
export { EXAM_NOTES_MAX, type ScheduleExamInput, type ScheduleExamResult } from './schedule';

export async function scheduleExamNow(
	db: LimitDb,
	actor: Actor,
	input: ScheduleExamInput,
	ip: string | null
): Promise<ScheduleExamResult> {
	return scheduleExam(db, actor, input, { settings: await examSettings(db) }, ip);
}
