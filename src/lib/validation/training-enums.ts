/* Training portal admin (docs/05 section 27). Client-safe: pages take the lists and limits from here. */

export const COURSE_STATUSES = ['draft', 'published', 'archived'] as const;
export const COURSE_LEVELS = ['novice', 'advanced', 'pro'] as const;
export type CourseLevel = (typeof COURSE_LEVELS)[number];

export const TOPIC_DIRECTIONS = ['up', 'down'] as const;

/** Option rows in the question form: 2 to 6 options (docs/05 section 27). */
export const QUESTION_OPTION_ROWS = 6;

/** Same as the media library and consents (docs/05 section 27). */
export const LESSON_PDF_MAX_BYTES = 10 * 1024 * 1024;

/** Inclusive limits of the quiz and admission settings (docs/todo.md 9.2, decision 2). */
export const COURSE_LIMITS = {
	quizSize: [1, 200],
	quizMinutes: [1, 600],
	retakeDays: [0, 365],
	attemptsLimit: [1, 50],
	attemptsPeriodDays: [1, 3650],
	minAge: [1, 99]
} as const;
