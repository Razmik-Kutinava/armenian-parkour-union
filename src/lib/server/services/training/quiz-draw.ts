import type { PortalText } from '#lib/i18n/localized.ts';

/* docs/03 section 18.3 p. 3: `quiz_size` random visible questions, equal by topic (the remainder —
 * to the topics with more questions, a short topic is topped up from the others), questions and
 * options shuffled. Decisions — docs/todo.md 9.6 (1). */

export type BankQuestion = {
	id: string;
	topicId: string;
	text: PortalText;
	options: PortalText[];
	correctIndex: number;
};
/** The attempt snapshot, as in docs/02 section 11 `quiz_attempts.questions`. */
export type SnapshotQuestion = {
	question_id: string;
	text: PortalText;
	options: PortalText[];
	correct_index: number;
};
/** A number in [0, 1). */
export type Random = () => number;

const cryptoRandom: Random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;

function shuffle<T>(items: readonly T[], random: Random): T[] {
	const out = [...items];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

/** Topics in their order; ties of the remainder go by that order. */
export function topicQuotas(topics: { topicId: string; count: number }[], size: number) {
	const quotas = new Map<string, number>();
	if (topics.length === 0) return quotas;
	const base = Math.floor(size / topics.length);
	const remainder = size % topics.length;
	const ranked = topics.map((t, i) => ({ ...t, i })).sort((a, b) => b.count - a.count || a.i - b.i);
	ranked.forEach((t, rank) => quotas.set(t.topicId, base + (rank < remainder ? 1 : 0)));
	return quotas;
}

function snapshot(q: BankQuestion, random: Random): SnapshotQuestion {
	const order = shuffle(
		q.options.map((_, i) => i),
		random
	);
	return {
		question_id: q.id,
		text: q.text,
		options: order.map((i) => q.options[i]),
		correct_index: order.indexOf(q.correctIndex)
	};
}

/** `null` — the bank is smaller than the quiz. */
export function drawQuiz(
	bank: BankQuestion[],
	topicOrder: string[],
	size: number,
	random: Random = cryptoRandom
): SnapshotQuestion[] | null {
	if (size < 1 || bank.length < size) return null;
	const byTopic = new Map<string, BankQuestion[]>(topicOrder.map((id) => [id, []]));
	for (const q of bank) byTopic.set(q.topicId, [...(byTopic.get(q.topicId) ?? []), q]);
	const groups = [...byTopic].filter(([, list]) => list.length > 0);
	const quotas = topicQuotas(
		groups.map(([topicId, list]) => ({ topicId, count: list.length })),
		size
	);
	const picked: BankQuestion[] = [];
	const rest: BankQuestion[] = [];
	for (const [topicId, list] of groups) {
		const mixed = shuffle(list, random);
		const quota = quotas.get(topicId) ?? 0;
		picked.push(...mixed.slice(0, quota));
		rest.push(...mixed.slice(quota));
	}
	picked.push(...shuffle(rest, random).slice(0, size - picked.length));
	return shuffle(picked, random).map((q) => snapshot(q, random));
}
