import { eq } from 'drizzle-orm';
import { pickLocalized } from '#lib/i18n/localized.ts';
import { translate } from '#lib/i18n/translate.ts';
import { settingsFormSchema } from '#lib/validation/site-settings-form.ts';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { certificates } from '../../db/schema/certification';
import { siteSettings } from '../../db/schema/service';
import { users } from '../../db/schema/users';
import { StorageNotConfigured, type PrivateStorage } from '../../storage/types';
import { writeAudit } from '../audit';
import { isUuid, type Actor } from '../users/target';
import type { CertificateImages } from './pdf-assets';
import { certificateContent, pdfLanguages } from './pdf-content';
import { renderCertificatePdf } from './pdf-render';
import type { CertificateSettings } from './settings';

/* docs/03 section 4 p. 5: the PDF is made on the server and kept in storage (`file_key`); the
 * private bucket, so a revoked certificate's PDF has no lasting address. docs/05 section 8: remake. */

export type PdfDeps = {
	storage: PrivateStorage;
	images: () => Promise<CertificateImages | null>;
	settings: CertificateSettings;
	siteUrl: string | undefined;
};
export type PdfOutcome =
	'ok' | 'not_found' | 'revoked' | 'assets_missing' | 'storage_missing' | 'site_url_missing';

/** One object per certificate: remaking overwrites it. */
export const certificatePdfKey = (userId: string, certificateId: string) =>
	`certificates/${userId}/${certificateId}.pdf`;

async function unionNames(db: LimitDb, languages: ReturnType<typeof pdfLanguages>) {
	const [row] = await db.select().from(siteSettings).where(eq(siteSettings.key, 'site_name'));
	const parsed = settingsFormSchema.shape.site_name.safeParse(row?.value);
	return languages.map((l) =>
		parsed.success ? pickLocalized(parsed.data, l) : translate(l, 'site.name')
	);
}

export async function storeCertificatePdf(
	db: LimitDb,
	deps: PdfDeps,
	certificateId: string
): Promise<PdfOutcome> {
	if (!isUuid(certificateId)) return 'not_found';
	const [row] = await db
		.select({
			cert: certificates,
			name: users.name,
			firstName: users.firstName,
			lastName: users.lastName
		})
		.from(certificates)
		.innerJoin(users, eq(users.id, certificates.userId))
		.where(eq(certificates.id, certificateId));
	if (!row) return 'not_found';
	if (row.cert.status === 'revoked') return 'revoked';
	if (!deps.siteUrl) return 'site_url_missing';
	const images = await deps.images();
	if (!images) return 'assets_missing';

	const languages = pdfLanguages(deps.settings);
	const content = certificateContent(row.cert, row, {
		languages,
		unionNames: await unionNames(db, languages),
		siteUrl: deps.siteUrl,
		signer: deps.settings.signer
	});
	const key = certificatePdfKey(row.cert.userId, row.cert.id);
	try {
		await deps.storage.put(key, await renderCertificatePdf(content, images), 'application/pdf');
	} catch (e) {
		if (e instanceof StorageNotConfigured) return 'storage_missing';
		throw e;
	}
	await db.update(certificates).set({ fileKey: key }).where(eq(certificates.id, row.cert.id));
	return 'ok';
}

/** After the issue commits: any failure is logged, the issue stands, the admin remakes the PDF. */
export async function pdfAfterIssue(
	db: LimitDb,
	deps: PdfDeps,
	certificateId: string
): Promise<PdfOutcome | 'failed'> {
	try {
		const outcome = await storeCertificatePdf(db, deps, certificateId);
		if (outcome !== 'ok') console.warn(`certificate ${certificateId}: no PDF (${outcome})`);
		return outcome;
	} catch (e) {
		console.warn(`certificate ${certificateId}: PDF failed`, e);
		return 'failed';
	}
}

/** docs/05 section 8 "remake the PDF" — the admin, e.g. after a name fix; logged. */
export async function regenerateCertificatePdf(
	db: LimitDb,
	actor: Actor,
	certificateId: string,
	deps: PdfDeps,
	ip: string | null
): Promise<PdfOutcome | 'not_allowed'> {
	if (!roleCan(actor.role, 'certificates.issue')) return 'not_allowed';
	const outcome = await storeCertificatePdf(db, deps, certificateId);
	if (outcome !== 'ok') return outcome;
	const [row] = await db.select().from(certificates).where(eq(certificates.id, certificateId));
	await writeAudit(db, {
		actorId: actor.id,
		action: 'certificate.pdf',
		entityType: 'certificate',
		entityId: certificateId,
		after: { number: row.number, fileKey: row.fileKey },
		ip
	});
	return 'ok';
}
