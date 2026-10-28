import { isLocale, localizePath, type Locale } from '#lib/i18n/locales.ts';
import { pickPortal, type PortalText } from '#lib/i18n/localized.ts';
import { translate } from '#lib/i18n/translate.ts';
import type { Mail } from '../../mail/resend';
import type { QuizMember } from './quiz-mail';

/* docs/03 section 18.6 p. 2: the decision on a practice video — to the member, in their language.
 * Decisions — docs/todo.md 9.7 (8). */

export function practiceDecisionLetter(
	member: QuizMember,
	course: { slug: string; title: PortalText },
	task: PortalText,
	decision: { status: 'approved' | 'rejected'; note: string | null },
	siteUrl: string | undefined
): Mail {
	const locale: Locale = isLocale(member.locale) ? member.locale : 'en';
	const kind = decision.status === 'approved' ? 'practiceApproved' : 'practiceRejected';
	const params = {
		name: member.firstName ?? member.name,
		course: pickPortal(course.title, locale),
		task: pickPortal(task, locale),
		note: decision.note ?? '',
		url: `${siteUrl ?? ''}${localizePath(`/cabinet/training/${course.slug}/practice`, locale)}`
	};
	const text = translate(locale, `training.mail.${kind}.text`, params);
	const comment =
		decision.status === 'approved' && decision.note
			? `\n\n${translate(locale, 'training.mail.practiceComment', params)}`
			: '';
	return {
		to: member.email,
		subject: translate(locale, `training.mail.${kind}.subject`),
		text: text + comment
	};
}
