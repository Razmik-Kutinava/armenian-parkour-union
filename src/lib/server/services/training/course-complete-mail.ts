import { isLocale, localizePath, type Locale } from '#lib/i18n/locales.ts';
import { pickPortal } from '#lib/i18n/localized.ts';
import { translate } from '#lib/i18n/translate.ts';
import type { Mail } from '../../mail/resend';
import type { AccessCourse, AccessMember } from './access-mail';

/* docs/03 section 18.5 p. 3: the course is finished — to the member in their language, to the
 * federation address in English (decision 3.7). Decisions — docs/todo.md 9.8 (4). */

const fullName = (m: AccessMember) => [m.firstName, m.lastName].filter(Boolean).join(' ') || m.name;

export function courseFinishedLetter(
	member: AccessMember,
	course: AccessCourse,
	siteUrl: string | undefined
): Mail {
	const locale: Locale = isLocale(member.locale) ? member.locale : 'en';
	const params = {
		name: member.firstName ?? member.name,
		course: pickPortal(course.title, locale),
		url: `${siteUrl ?? ''}${localizePath('/cabinet/training', locale)}`
	};
	return {
		to: member.email,
		subject: translate(locale, 'training.mail.courseFinished.subject'),
		text: translate(locale, 'training.mail.courseFinished.text', params)
	};
}

export function courseFinishedAdminLetter(
	to: string,
	member: AccessMember,
	course: AccessCourse,
	examId: string,
	siteUrl: string | undefined
): Mail {
	const params = {
		name: fullName(member),
		course: pickPortal(course.title, 'en'),
		url: `${siteUrl ?? ''}/admin/exams/${examId}`
	};
	return {
		to,
		subject: translate('en', 'training.mail.courseFinishedAdmin.subject'),
		text: translate('en', 'training.mail.courseFinishedAdmin.text', params)
	};
}
