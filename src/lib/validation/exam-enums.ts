/* Exam kinds and results (docs/02 `exam_kind`, `exam_result`). Client-safe: pages take them from here. */

export const EXAM_KINDS = ['level_advanced', 'level_pro', 'trainer', 'judge'] as const;
export type ExamKindValue = (typeof EXAM_KINDS)[number];

export const EXAM_RESULTS = ['scheduled', 'passed', 'failed', 'cancelled'] as const;
export type ExamResultValue = (typeof EXAM_RESULTS)[number];

/** What staff can record on a scheduled exam (docs/05 section 7). */
export const EXAM_DECISIONS = ['passed', 'failed', 'cancelled'] as const;

/** Notes and the result comment; the same limit as the service (`EXAM_NOTES_MAX`). */
export const EXAM_TEXT_MAX = 2000;
