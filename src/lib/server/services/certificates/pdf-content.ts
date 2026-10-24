import type { Locale } from '#lib/i18n/locales.ts';
import { translate, type MessageKey } from '#lib/i18n/translate.ts';
import { certificateTitleKey } from './mail';
import type { CertificateSettings } from './settings';

/* docs/08 section 10: what the PDF says, in which languages — kept apart from the drawing. */

export type PdfCertificate = {
	kind: 'level' | 'trainer' | 'judge';
	/** `novice` never comes from a certificate (6.1 check); the column type allows it. */
	level: 'novice' | 'advanced' | 'pro' | null;
	category: string | null;
	number: string;
	publicToken: string;
	issuedAt: Date;
	expiresAt: Date | null;
};
export type PdfHolder = { name: string; firstName: string | null; lastName: string | null };

/** The first language large, the others on one line below. */
export type Multilingual = { main: string; rest: string[] };
export type PdfField = { label: string; value: string };

export type CertificateContent = {
	number: string;
	union: Multilingual;
	title: Multilingual;
	holder: string;
	kind: Multilingual;
	category: PdfField | null;
	fields: PdfField[];
	signature: string;
	verify: { label: string; url: string };
};

export type ContentOptions = { languages: Locale[]; unionNames: string[]; siteUrl: string };

export const pdfLanguages = (s: Pick<CertificateSettings, 'pdfRussian'>): Locale[] =>
	s.pdfRussian ? ['hy', 'en', 'ru'] : ['hy', 'en'];

/** `DD.MM.YYYY` in Yerevan — the same in every language. */
export const yerevanDate = (d: Date) =>
	d.toLocaleDateString('ru-RU', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		timeZone: 'Asia/Yerevan'
	});

const multilingual = ([main, ...rest]: string[]): Multilingual => ({
	main,
	rest: rest.filter((x, i) => x !== main && rest.indexOf(x) === i)
});

export function certificateContent(
	cert: PdfCertificate,
	holder: PdfHolder,
	{ languages, unionNames, siteUrl }: ContentOptions
): CertificateContent {
	const each = (key: MessageKey) => languages.map((l) => translate(l, key));
	const label = (key: MessageKey) => each(key).join(' / ');
	const field = (key: MessageKey, value: string) => ({ label: label(key), value });
	const fullName = [holder.firstName, holder.lastName].map((x) => x?.trim()).filter(Boolean);
	return {
		number: cert.number,
		union: multilingual(unionNames),
		title: multilingual(each('certificates.pdf.title')),
		holder: fullName.length ? fullName.join(' ') : holder.name,
		kind: multilingual(
			each(
				certificateTitleKey({ kind: cert.kind, level: cert.level === 'novice' ? null : cert.level })
			)
		),
		category: cert.category ? field('certificates.pdf.category', cert.category) : null,
		fields: [
			field('certificates.pdf.number', cert.number),
			field('certificates.pdf.issued', yerevanDate(cert.issuedAt)),
			...(cert.expiresAt
				? [field('certificates.pdf.valid_until', yerevanDate(cert.expiresAt))]
				: [])
		],
		signature: label('certificates.pdf.signature'),
		verify: {
			label: label('certificates.pdf.verify'),
			url: `${siteUrl.replace(/\/+$/, '')}/certificate/${cert.publicToken}`
		}
	};
}
