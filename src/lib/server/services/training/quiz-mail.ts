import { isLocale, localizePath, type Locale } from '#lib/i18n/locales.ts';
import { pickPortal, type PortalText } from '#lib/i18n/localized.ts';
import { translate } from '#lib/i18n/translate.ts';
import type { Mail } from '../../mail/resend';

/* docs/03 section 18.6 p. 2: the quiz result and the retake date — to the member, in their
 * language. Decisions — docs/todo.md 9.6 (7). */

export type QuizMember = { email: string; locale: string; firstName: string | null; name: string };
export type QuizResult = { correct: number; total: number; passCount: number; passed: boolean };

const moment = (date: Date, locale: Locale) =>
	date.toLocaleString(locale, { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Yerevan' });

/** `retakeAt` null — a new attempt is possible right away. */
export function quizResultLetter(
	member: QuizMember,
	course: { slug: string; title: PortalText },
	result: QuizResult,
	retakeAt: Date | null,
	siteUrl: string | undefined
): Mail {
	const locale: Locale = isLocale(member.locale) ? member.locale : 'en';
	const kind = result.passed ? 'quizPassed' : 'quizFailed';
	const params = {
		name: member.firstName ?? member.name,
		course: pickPortal(course.title, locale),
		correct: String(result.correct),
		total: String(result.total),
		need: String(result.passCount),
		retake: retakeAt ? moment(retakeAt, locale) : translate(locale, 'training.mail.quizRetakeNow'),
		url: `${siteUrl ?? ''}${localizePath(`/cabinet/training/${course.slug}/test`, locale)}`
	};
	return {
		to: member.email,
		subject: translate(locale, `training.mail.${kind}.subject`),
		text: translate(locale, `training.mail.${kind}.text`, params)
	};
}
