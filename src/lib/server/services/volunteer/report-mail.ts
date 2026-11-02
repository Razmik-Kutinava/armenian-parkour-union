import { isLocale, localizePath, type Locale } from '#lib/i18n/locales.ts';
import { translate } from '#lib/i18n/translate.ts';
import type { Mail } from '../../mail/resend';

/* docs/03 section 19.9 p. 2: the decision on a photo report — to the member, in their language. */

export type ReportRecipient = {
	email: string;
	locale: string;
	firstName: string | null;
	name: string;
};

export type ReportDecision =
	{ status: 'approved'; points: number } | { status: 'rejected'; reason: string };

export function reportDecisionLetter(
	to: ReportRecipient,
	decision: ReportDecision,
	siteUrl: string | undefined
): Mail {
	const locale: Locale = isLocale(to.locale) ? to.locale : 'en';
	const params = {
		name: to.firstName ?? to.name,
		url: `${siteUrl ?? ''}${localizePath('/cabinet/volunteer', locale)}`,
		points: decision.status === 'approved' ? String(decision.points) : '',
		reason: decision.status === 'rejected' ? decision.reason : ''
	};
	if (decision.status === 'rejected') {
		return {
			to: to.email,
			subject: translate(locale, 'volunteerReports.mail.rejected.subject'),
			text: translate(locale, 'volunteerReports.mail.rejected.text', params)
		};
	}
	const text =
		decision.points > 0
			? 'volunteerReports.mail.approved.textPoints'
			: 'volunteerReports.mail.approved.text';
	return {
		to: to.email,
		subject: translate(locale, 'volunteerReports.mail.approved.subject'),
		text: translate(locale, text, params)
	};
}
