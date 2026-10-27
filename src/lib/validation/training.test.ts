import { describe, expect, it } from 'vitest';
import {
	courseFormSchema,
	isLessonPdfKey,
	lessonFormSchema,
	lessonPdfKey,
	lessonPdfSignSchema,
	LESSON_PDF_MAX_BYTES,
	topicMoveSchema
} from './training';

/* docs/05 section 27; limits — docs/todo.md 9.2 (decisions 2, 5, 6). */

const COURSE = {
	slug: 'trainer-course',
	examKind: 'trainer',
	status: 'draft',
	quizSize: '27',
	passCount: '25',
	quizMinutes: '60',
	retakeDays: '30',
	attemptsLimit: '3',
	attemptsPeriodDays: '180',
	requiresMembership: 'on',
	minAge: '18',
	requiredLevel: 'advanced'
};
const course = (extra: Record<string, unknown> = {}) =>
	courseFormSchema.safeParse({
		...COURSE,
		title: { en: 'Coach course' },
		description: {},
		...extra
	});
const issue = (r: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
	r.error?.issues[0].path.join('.');

describe('course form', () => {
	it('takes the coach course settings', () => {
		const r = course();
		expect(r.success).toBe(true);
		expect(r.data).toMatchObject({
			examKind: 'trainer',
			quizSize: 27,
			passCount: 25,
			requiresMembership: true,
			minAge: 18,
			requiredLevel: 'advanced',
			description: {}
		});
	});

	it('empty admission fields mean no condition; no checkbox — no membership needed', () => {
		const r = course({ minAge: '', requiredLevel: '', requiresMembership: undefined });
		expect(r.data).toMatchObject({ minAge: null, requiredLevel: null, requiresMembership: false });
	});

	it('the pass count is from 1 to the quiz size', () => {
		expect(issue(course({ passCount: '28' }))).toBe('passCount');
		expect(issue(course({ passCount: '0' }))).toBe('passCount');
		expect(course({ passCount: '27' }).success).toBe(true);
	});

	it('numbers stay in their limits', () => {
		expect(issue(course({ quizSize: '0' }))).toBe('quizSize');
		expect(issue(course({ quizMinutes: '0' }))).toBe('quizMinutes');
		expect(issue(course({ retakeDays: '-1' }))).toBe('retakeDays');
		expect(course({ retakeDays: '0' }).success).toBe(true);
		expect(issue(course({ attemptsLimit: '0' }))).toBe('attemptsLimit');
		expect(issue(course({ attemptsPeriodDays: '0' }))).toBe('attemptsPeriodDays');
		expect(issue(course({ minAge: '0' }))).toBe('minAge');
	});

	it('an unknown exam kind, level or status is refused', () => {
		expect(issue(course({ examKind: 'boss' }))).toBe('examKind');
		expect(issue(course({ requiredLevel: 'master' }))).toBe('requiredLevel');
		expect(issue(course({ status: 'deleted' }))).toBe('status');
	});

	it('English title is required; a description in Russian only needs English too', () => {
		expect(issue(course({ title: { en: '' } }))).toBe('title.en');
		expect(issue(course({ description: { ru: 'Описание' } }))).toBe('description.en');
	});
});

describe('lesson form', () => {
	const lesson = (extra: Record<string, unknown> = {}) =>
		lessonFormSchema(null).safeParse({
			topicId: '',
			title: { en: 'Safety' },
			body: { en: '<p>Warm up <script>x()</script></p>' },
			status: 'draft',
			...extra
		});

	it('no topic is allowed; the text is cleaned', () => {
		const r = lesson();
		expect(r.data).toMatchObject({ topicId: null, sortOrder: 0, status: 'draft' });
		expect(r.data?.body.en).not.toContain('script');
	});

	it('a topic is an id; a bad id or order is refused', () => {
		const id = crypto.randomUUID();
		expect(lesson({ topicId: id }).data?.topicId).toBe(id);
		expect(issue(lesson({ topicId: 'x' }))).toBe('topicId');
		expect(issue(lesson({ sortOrder: '10000' }))).toBe('sortOrder');
	});
});

describe('lesson PDF', () => {
	it('only a PDF up to 10 MB', () => {
		const sign = (mime: string, size: number) => lessonPdfSignSchema.safeParse({ mime, size });
		expect(sign('application/pdf', LESSON_PDF_MAX_BYTES).success).toBe(true);
		expect(sign('application/pdf', LESSON_PDF_MAX_BYTES + 1).success).toBe(false);
		expect(sign('application/pdf', 0).success).toBe(false);
		expect(sign('image/png', 10).success).toBe(false);
	});

	it('the key is in the course folder and never comes from the user', () => {
		const courseId = crypto.randomUUID();
		const key = lessonPdfKey(courseId);
		expect(key).toMatch(new RegExp(`^training/${courseId}/[0-9a-f-]{36}\\.pdf$`));
		expect(isLessonPdfKey(courseId, key)).toBe(true);
		expect(isLessonPdfKey(crypto.randomUUID(), key)).toBe(false);
		expect(isLessonPdfKey(courseId, `training/${courseId}/../x.pdf`)).toBe(false);
		expect(isLessonPdfKey(courseId, `consents/${courseId}/${crypto.randomUUID()}.pdf`)).toBe(false);
	});
});

describe('topic move', () => {
	it('up or down only', () => {
		const topicId = crypto.randomUUID();
		expect(topicMoveSchema.safeParse({ topicId, direction: 'up' }).success).toBe(true);
		expect(topicMoveSchema.safeParse({ topicId, direction: 'left' }).success).toBe(false);
	});
});
