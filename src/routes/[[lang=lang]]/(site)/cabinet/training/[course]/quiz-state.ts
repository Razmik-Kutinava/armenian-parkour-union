import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
import type { QuizPageState } from '#lib/server/services/training/quiz-read.ts';

/** Date and time as people in Armenia see it: the retake opens at that moment. */
export const quizMoment = (date: Date) =>
	date.toLocaleString(currentLocale(), {
		dateStyle: 'long',
		timeStyle: 'short',
		timeZone: 'Asia/Yerevan'
	});

export function quizStateText(state: QuizPageState) {
	if (state.kind === 'wait')
		return t('cabinet.quiz.state.wait', { date: quizMoment(state.retakeAt) });
	return t(`cabinet.quiz.state.${state.kind}`);
}
