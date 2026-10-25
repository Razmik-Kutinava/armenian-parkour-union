import { isLocale, localizePath, type Locale } from '#lib/i18n/locales.ts';
import { translate } from '#lib/i18n/translate.ts';
import type { Mail } from '../../mail/resend';

export type VideoRecipient = {
	email: string;
	locale: string;
	firstName: string | null;
	name: string;
};

export type VideoDecision =
	{ status: 'approved'; points: number } | { status: 'rejected'; reason: string };

/** docs/03 section 14: the member learns the decision on their video, in their language. */
export function videoDecisionLetter(
	to: VideoRecipient,
	title: string | null,
	decision: VideoDecision,
	siteUrl: string | undefined
): Mail {
	const locale: Locale = isLocale(to.locale) ? to.locale : 'en';
	const params = {
		name: to.firstName ?? to.name,
		title: title ?? '',
		url: `${siteUrl ?? ''}${localizePath('/cabinet/videos', locale)}`,
		points: decision.status === 'approved' ? String(decision.points) : '',
		reason: decision.status === 'rejected' ? decision.reason : ''
	};
	if (decision.status === 'rejected') {
		return {
			to: to.email,
			subject: translate(locale, 'videos.mail.rejected.subject'),
			text: translate(locale, 'videos.mail.rejected.text', params)
		};
	}
	const text =
		decision.points > 0 ? 'videos.mail.approved.textPoints' : 'videos.mail.approved.text';
	return {
		to: to.email,
		subject: translate(locale, 'videos.mail.approved.subject'),
		text: translate(locale, text, params)
	};
}
