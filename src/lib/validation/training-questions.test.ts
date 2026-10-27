import { describe, expect, it } from 'vitest';
import { questionFormSchema, quizBankFileSchema } from './training-questions';

/* docs/05 section 27 "Question bank"; decisions — docs/todo.md 9.3 (1, 4, 7). */

const topicId = crypto.randomUUID();
const form = (extra: Record<string, unknown> = {}) =>
	questionFormSchema.safeParse({
		topicId,
		text: { ru: 'Сколько вопросов в тесте Maddocks?' },
		option0: { ru: '3' },
		option1: { ru: '5' },
		option2: { ru: '10' },
		correct: '1',
		...extra
	});
const issue = (r: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
	r.error?.issues[0].path.join('.');

describe('question form', () => {
	it('a question only in Russian is enough; the source is optional', () => {
		const r = form();
		expect(r.success).toBe(true);
		expect(r.data).toEqual({
			topicId,
			text: { ru: 'Сколько вопросов в тесте Maddocks?' },
			options: [{ ru: '3' }, { ru: '5' }, { ru: '10' }],
			correctIndex: 1,
			source: null
		});
		expect(form({ source: ' Первая помощь, раздел 3.2 ' }).data?.source).toBe(
			'Первая помощь, раздел 3.2'
		);
	});

	it('empty rows are dropped and the correct one is renumbered', () => {
		const r = form({ option0: {}, option1: { ru: 'A' }, option3: { ru: 'B' }, correct: '3' });
		expect(r.data).toMatchObject({ options: [{ ru: 'A' }, { ru: '10' }, { ru: 'B' }] });
		expect(r.data?.correctIndex).toBe(2);
	});

	it('the correct mark is on a filled row', () => {
		expect(issue(form({ correct: '4' }))).toBe('correct');
		expect(issue(form({ correct: '' }))).toBe('correct');
		expect(issue(form({ correct: '9' }))).toBe('correct');
	});

	it('two to six options', () => {
		expect(issue(form({ option1: {}, option2: {}, correct: '0' }))).toBe('options');
		const six = Object.fromEntries([0, 1, 2, 3, 4, 5].map((n) => [`option${n}`, { ru: `${n}` }]));
		expect(form(six).data?.options).toHaveLength(6);
	});

	it('each option has every language of the question text', () => {
		const text = { ru: 'Вопрос', en: 'Question' };
		expect(issue(form({ text }))).toBe('option0.en');
		const both = (s: string) => ({ ru: s, en: s });
		expect(
			form({ text, option0: both('3'), option1: both('5'), option2: both('10') }).success
		).toBe(true);
	});

	it('a text in some language and a topic are required; lengths are limited', () => {
		expect(issue(form({ text: {} }))).toBe('text');
		expect(issue(form({ topicId: '' }))).toBe('topicId');
		expect(issue(form({ text: { ru: 'x'.repeat(1001) } }))).toBe('text.ru');
		expect(issue(form({ option0: { ru: 'x'.repeat(301) } }))).toBe('option0.ru');
		expect(issue(form({ source: 'x'.repeat(201) }))).toBe('source');
	});
});

const COURSE = {
	slug: 'trainer',
	examKind: 'trainer',
	title: { ru: 'Курс тренера' },
	status: 'draft',
	quizSize: 27,
	passCount: 25,
	quizMinutes: 60,
	retakeDays: 30,
	attemptsLimit: 3,
	attemptsPeriodDays: 180,
	requiresMembership: true,
	minAge: 18,
	requiredLevel: 'advanced'
};
const question = (correct = 1) => ({
	text: { ru: 'Вопрос' },
	options: [{ ru: 'А' }, { ru: 'Б' }, { ru: 'В' }, { ru: 'Г' }],
	correct,
	source: 'УТП 1-го года, модуль 3'
});
const bank = (questions: unknown[] = [question()]) =>
	quizBankFileSchema.safeParse({
		course: COURSE,
		topics: [{ title: { ru: 'УТП 1-го года' }, questions }]
	});

describe('quiz bank file', () => {
	it('a course block and topics with questions', () => {
		const r = bank();
		expect(r.success).toBe(true);
		expect(r.data?.course).toMatchObject({ slug: 'trainer', minAge: 18, requiresMembership: true });
		expect(r.data?.topics[0].questions[0]).toEqual({
			text: { ru: 'Вопрос' },
			options: [{ ru: 'А' }, { ru: 'Б' }, { ru: 'В' }, { ru: 'Г' }],
			correctIndex: 1,
			source: 'УТП 1-го года, модуль 3'
		});
	});

	it('one bad question rejects the whole file', () => {
		expect(bank([question(), question(4)]).success).toBe(false);
		expect(bank([question(), { ...question(), options: [{ ru: 'А' }] }]).success).toBe(false);
		expect(bank([question(), { ...question(), text: {} }]).success).toBe(false);
		expect(bank([]).success).toBe(false);
	});
});
