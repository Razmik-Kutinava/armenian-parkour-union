import { describe, expect, it } from 'vitest';
import { drawQuiz, topicQuotas, type BankQuestion } from './quiz-draw';

/* docs/03 section 18.3 p. 3; decisions — docs/todo.md 9.6 (1). */

/** A repeatable sequence in [0, 1): the same draw on every run. */
function seeded(seed = 42) {
	let s = seed;
	return () => {
		s = (s * 1_103_515_245 + 12_345) % 2_147_483_648;
		return s / 2_147_483_648;
	};
}

function bank(counts: number[]): BankQuestion[] {
	return counts.flatMap((count, t) =>
		Array.from({ length: count }, (_, i) => ({
			id: `t${t}-q${i}`,
			topicId: `t${t}`,
			text: { ru: `Вопрос ${t}.${i}` },
			options: [{ ru: `A ${t}.${i}` }, { ru: `B ${t}.${i}` }, { ru: `C ${t}.${i}` }],
			correctIndex: i % 3
		}))
	);
}
const order = (counts: number[]) => counts.map((_, t) => `t${t}`);
const perTopic = (ids: string[]) =>
	ids.reduce<Record<string, number>>((acc, id) => {
		const topic = id.split('-')[0];
		acc[topic] = (acc[topic] ?? 0) + 1;
		return acc;
	}, {});

describe('quiz draw: equal by topic', () => {
	it('27 from 10 topics: 2 each, the remainder 7 — to the topics with more questions', () => {
		const counts = [10, 12, 10, 11, 10, 15, 10, 13, 10, 14];
		const quotas = topicQuotas(
			counts.map((count, t) => ({ topicId: `t${t}`, count })),
			27
		);
		expect([...quotas.values()].reduce((a, b) => a + b, 0)).toBe(27);
		for (const t of ['t5', 't9', 't7', 't1', 't3']) expect(quotas.get(t)).toBe(3);
		const threes = [...quotas.entries()].filter(([, n]) => n === 3).map(([t]) => t);
		expect(threes).toHaveLength(7);
		expect(threes).toEqual(expect.arrayContaining(['t0', 't2']));
		expect(quotas.get('t8')).toBe(2);
	});

	it('the draw has the quota of every topic and no repeats', () => {
		const counts = [10, 12, 10, 11, 10, 15, 10, 13, 10, 14];
		const quiz = drawQuiz(bank(counts), order(counts), 27, seeded())!;
		const ids = quiz.map((q) => q.question_id);
		expect(new Set(ids).size).toBe(27);
		const got = perTopic(ids);
		expect(Object.values(got).sort()).toEqual([2, 2, 2, 3, 3, 3, 3, 3, 3, 3]);
		expect(got.t8).toBe(2);
	});

	it('a topic short of its quota gives all it has, the rest comes from other topics', () => {
		const counts = [1, 10, 10];
		const quiz = drawQuiz(bank(counts), order(counts), 9, seeded())!;
		const got = perTopic(quiz.map((q) => q.question_id));
		expect(quiz).toHaveLength(9);
		expect(got.t0).toBe(1);
		expect(got.t1 + got.t2).toBe(8);
	});

	it('a bank smaller than the quiz: no draw', () => {
		expect(drawQuiz(bank([3, 2]), order([3, 2]), 6, seeded())).toBeNull();
		expect(drawQuiz([], [], 1, seeded())).toBeNull();
	});
});

describe('quiz draw: shuffled snapshot', () => {
	const counts = [10, 10, 10];
	const source = bank(counts);
	const byId = new Map(source.map((q) => [q.id, q]));

	it('the correct option follows the shuffle: same text under the new index', () => {
		const quiz = drawQuiz(source, order(counts), 27, seeded(7))!;
		for (const q of quiz) {
			const original = byId.get(q.question_id)!;
			expect(q.text).toEqual(original.text);
			expect([...q.options].sort((a, b) => a.ru!.localeCompare(b.ru!))).toEqual(original.options);
			expect(q.options[q.correct_index]).toEqual(original.options[original.correctIndex]);
		}
		expect(quiz.some((q) => q.correct_index !== byId.get(q.question_id)!.correctIndex)).toBe(true);
	});

	it('questions are not grouped by topic', () => {
		const quiz = drawQuiz(source, order(counts), 27, seeded(3))!;
		const topics = quiz.map((q) => q.question_id.split('-')[0]);
		expect(topics).not.toEqual([...topics].sort());
	});

	it('the snapshot has exactly the fields of docs/02 section 11', () => {
		const [q] = drawQuiz(source, order(counts), 1, seeded())!;
		expect(Object.keys(q).sort()).toEqual(['correct_index', 'options', 'question_id', 'text']);
	});
});
