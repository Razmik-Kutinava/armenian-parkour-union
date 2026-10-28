import { isLocale, localizePath, type Locale } from '#lib/i18n/locales.ts';
import { pickPortal, type PortalText } from '#lib/i18n/localized.ts';
import { translate } from '#lib/i18n/translate.ts';
import type { Mail } from '../../mail/resend';

/* docs/03 section 18.6 p. 2; decisions — docs/todo.md 9.4 (2, 4). */

export type AccessMember = {
	email: string;
	locale: string;
	firstName: string | null;
	lastName: string | null;
	name: string;
};

const fullName = (m: AccessMember) => [m.firstName, m.lastName].filter(Boolean).join(' ') || m.name;
export type AccessCourse = { slug: string; title: PortalText };
export type AccessDecision =
	{ status: 'approved' } | { status: 'rejected' | 'revoked'; reason: string };

/** The federation address has no language: English, as for a guest (decision 3.7). */
export function accessRequestLetter(
	to: string,
	member: AccessMember,
	course: AccessCourse,
	siteUrl: string | undefined
): Mail {
	const params = {
		name: fullName(member),
		course: pickPortal(course.title, 'en'),
		url: `${siteUrl ?? ''}/admin/training/access`
	};
	return {
		to,
		subject: translate('en', 'training.mail.request.subject'),
		text: translate('en', 'training.mail.request.text', params)
	};
}

export function accessDecisionLetter(
	member: AccessMember,
	course: AccessCourse,
	decision: AccessDecision,
	siteUrl: string | undefined
): Mail {
	const locale: Locale = isLocale(member.locale) ? member.locale : 'en';
	const path =
		decision.status === 'approved' ? `/cabinet/training/${course.slug}` : '/cabinet/training';
	const params = {
		name: member.firstName ?? member.name,
		course: pickPortal(course.title, locale),
		url: `${siteUrl ?? ''}${localizePath(path, locale)}`,
		reason: decision.status === 'approved' ? '' : decision.reason
	};
	return {
		to: member.email,
		subject: translate(locale, `training.mail.${decision.status}.subject`),
		text: translate(locale, `training.mail.${decision.status}.text`, params)
	};
}
