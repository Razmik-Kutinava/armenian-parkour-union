import type { MessageKey } from '#lib/i18n/translate.ts';
import type { ExamResultOutcome, ScheduleExamResult } from '#lib/server/services/exams/index.ts';

/* Service refusals → messages (docs/05 section 1, item 11). 403 / 404 are answered by the route. */

type ScheduleRefusal = Exclude<
	Extract<ScheduleExamResult, { ok: false }>['reason'],
	'not_allowed' | 'confirm_level'
>;

export const scheduleMessage = (reason: ScheduleRefusal): MessageKey => `exams.refusal.${reason}`;

/** The form field a refusal belongs to; the rest go above the form. */
export const scheduleField = (reason: ScheduleRefusal) =>
	reason === 'event_not_found' ? 'eventId' : reason === 'examiner_invalid' ? 'examinerId' : null;

export const resultMessage = (
	outcome: Exclude<ExamResultOutcome, 'ok' | 'not_allowed' | 'not_found'>
): MessageKey => `exams.refusal.${outcome}`;
