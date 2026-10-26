import { eq } from 'drizzle-orm';
import type { LocalizedText } from '#lib/i18n/localized.ts';
import { locales } from '#lib/i18n/locales.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { siteSettings } from '../../db/schema/service';
import { writeSettings } from '../site-settings';
import type { Actor } from '../users/target';

/* docs/03 section 4.6, 16: `site_settings.certificates`; coach and judge — 2 years by default.
 * docs/08 section 10: Russian in the PDF is optional (on by default, questions.md stage 6).
 * Letters before a coach or judge certificate ends — 30 and 7 days (questions.md stage 6, 6.9).
 * The signer under the PDF line — name and title, they change with the head (questions.md stage 6). */

export type CertificateSigner = { name: LocalizedText; title: LocalizedText };

export type CertificateSettings = {
	/** Months a coach or judge certificate is valid by default. */
	staffValidMonths: number;
	/** The PDF carries Russian next to Armenian and English. */
	pdfRussian: boolean;
	/** Days before a coach or judge certificate ends when a letter goes. */
	staffRemindDays: number[];
	/** `null` — the plain "Signature" under the line. */
	signer: CertificateSigner | null;
};

export const CERTIFICATE_DEFAULTS: CertificateSettings = {
	staffValidMonths: 24,
	pdfRussian: true,
	staffRemindDays: [30, 7],
	signer: null
};

const isMonths = (v: unknown): v is number =>
	typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 1200;

const isDay = (v: unknown): v is number =>
	typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 365;

const isRemindDays = (v: unknown): v is number[] =>
	Array.isArray(v) && v.length >= 1 && v.length <= 10 && v.every(isDay);

const isObject = (v: unknown): v is Record<string, unknown> =>
	!!v && typeof v === 'object' && !Array.isArray(v);

const isText = (v: unknown): v is LocalizedText =>
	isObject(v) &&
	typeof v.en === 'string' &&
	v.en.trim() !== '' &&
	locales.every((l) => v[l] === undefined || typeof v[l] === 'string');

const isSigner = (v: unknown): v is CertificateSigner =>
	isObject(v) && isText(v.name) && isText(v.title);

/** The stored snake_case value; a missing or broken field — its default. */
export function parseCertificateSettings(value: unknown): CertificateSettings {
	if (!isObject(value)) return CERTIFICATE_DEFAULTS;
	const {
		staff_valid_months: months,
		pdf_russian: russian,
		staff_remind_days: remind,
		signer
	} = value;
	return {
		staffValidMonths: isMonths(months) ? months : CERTIFICATE_DEFAULTS.staffValidMonths,
		pdfRussian: typeof russian === 'boolean' ? russian : CERTIFICATE_DEFAULTS.pdfRussian,
		staffRemindDays: isRemindDays(remind) ? remind : CERTIFICATE_DEFAULTS.staffRemindDays,
		signer: isSigner(signer) ? signer : null
	};
}

async function storedValue(db: LimitDb): Promise<unknown> {
	const [row] = await db
		.select({ value: siteSettings.value })
		.from(siteSettings)
		.where(eq(siteSettings.key, 'certificates'));
	return row?.value;
}

export async function certificateSettings(db: LimitDb): Promise<CertificateSettings> {
	return parseCertificateSettings(await storedValue(db));
}

/** Admin only (docs/04: settings.write); the other fields of the key stay as stored. */
export async function saveCertificateSigner(
	db: LimitDb,
	actor: Actor,
	signer: CertificateSigner | null,
	ip: string | null
): Promise<'ok' | 'not_admin'> {
	if (actor.role !== 'admin') return 'not_admin';
	const current = await storedValue(db);
	const next: Record<string, unknown> = isObject(current) ? { ...current } : {};
	if (signer) next.signer = signer;
	else delete next.signer;
	await writeSettings(db, actor, { certificates: next }, ip);
	return 'ok';
}
