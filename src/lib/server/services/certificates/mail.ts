import { localizePath } from '#lib/i18n/locales.ts';
import { translate, type MessageKey } from '#lib/i18n/translate.ts';
import type { Mail } from '../../mail/resend';
import { languageOf, type RegistrationRecipient } from '../registrations/mail';

/* docs/03 section 14: "a certificate is issued" — after the commit, in the member's language. */

export type CertificateLetterDeps = {
	send: (mail: Mail) => Promise<void>;
	siteUrl: string | undefined;
};

type Issued = {
	kind: 'level' | 'trainer' | 'judge';
	level: 'advanced' | 'pro' | null;
	number: string;
	publicToken: string;
	issuedAt: Date;
};

const TITLES: Record<string, MessageKey> = {
	'level/advanced': 'certificates.kind.level_advanced',
	'level/pro': 'certificates.kind.level_pro',
	'trainer/': 'certificates.kind.trainer',
	'judge/': 'certificates.kind.judge'
};

export const certificateTitleKey = (c: Pick<Issued, 'kind' | 'level'>): MessageKey =>
	TITLES[`${c.kind}/${c.level ?? ''}`];

export function issuedLetter(
	to: RegistrationRecipient,
	cert: Issued,
	siteUrl: string | undefined
): Mail {
	const locale = languageOf(to);
	const url = (path: string) => `${siteUrl ?? ''}${localizePath(path, locale)}`;
	const params = {
		name: to.firstName ?? to.name,
		number: cert.number,
		title: translate(locale, certificateTitleKey(cert)),
		date: cert.issuedAt.toLocaleDateString(locale, { dateStyle: 'long', timeZone: 'Asia/Yerevan' }),
		verify: url(`/certificate/${cert.publicToken}`),
		url: url('/cabinet/progress')
	};
	return {
		to: to.email,
		subject: translate(locale, 'certificates.mail.issued.subject', params),
		text: translate(locale, 'certificates.mail.issued.text', params)
	};
}

export async function sendCertificateLetter(send: CertificateLetterDeps['send'], mail: Mail) {
	await send(mail).catch((e) => console.warn(`certificate letter to ${mail.to} not sent`, e));
}
