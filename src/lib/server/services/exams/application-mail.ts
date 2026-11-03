import { isLocale, localizePath, type Locale } from '#lib/i18n/locales.ts';
import { translate } from '#lib/i18n/translate.ts';
import type { Mail } from '../../mail/resend';
import type { ExamKind } from './admission';

/* Letters after commit: new request → federation; reject → member (docs/todo.md). */

export type ApplicationMember = {
	email: string;
	locale: string;
	firstName: string | null;
	lastName: string | null;
	name: string;
};

const fullName = (m: ApplicationMember) =>
	[m.firstName, m.lastName].filter(Boolean).join(' ') || m.name;

export function applicationRequestLetter(
	to: string,
	member: ApplicationMember,
	kind: ExamKind,
	siteUrl: string | undefined
): Mail {
	const params = {
		name: fullName(member),
		exam: translate('en', `exams.kind.${kind}`),
		url: `${siteUrl ?? ''}/admin/exams/applications`
	};
	return {
		to,
		subject: translate('en', 'exams.mail.request.subject'),
		text: translate('en', 'exams.mail.request.text', params)
	};
}

export function applicationRejectLetter(
	member: ApplicationMember,
	kind: ExamKind,
	reason: string,
	siteUrl: string | undefined
): Mail {
	const locale: Locale = isLocale(member.locale) ? member.locale : 'en';
	const params = {
		name: member.firstName ?? member.name,
		exam: translate(locale, `exams.kind.${kind}`),
		reason,
		url: `${siteUrl ?? ''}${localizePath('/cabinet/progress', locale)}`
	};
	return {
		to: member.email,
		subject: translate(locale, 'exams.mail.rejected.subject'),
		text: translate(locale, 'exams.mail.rejected.text', params)
	};
}
