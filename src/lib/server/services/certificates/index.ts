import { CERTIFICATE_ASSETS_DIR, PUBLIC_SITE_URL } from '$app/env/private';
import type { LimitDb } from '../../auth/rate-limit';
import { sendMail } from '../../mail';
import { r2Private } from '../../storage/r2';
import type { Actor } from '../users/target';
import { issueCertificate, type IssueCertificateInput, type IssueCertificateResult } from './issue';
import { loadCertificateImages } from './pdf-assets';
import { regenerateCertificatePdf, type PdfDeps } from './pdf-store';
import { certificateSettings, type CertificateSettings } from './settings';

/* docs/05 section 8: routes call these; settings come from `site_settings.certificates`. */

export type { IssueCertificateInput, IssueCertificateResult, IssueRefusal } from './issue';
export { CERTIFICATE_CATEGORY_MAX, CERTIFICATE_COMMENT_MAX } from './issue-input';
export { certificateTitleKey } from './mail';
export { certificatePdfKey, type PdfOutcome } from './pdf-store';
export { revokeCertificate, type RevokeInput, type RevokeOutcome } from './revoke';
export { certificateSettings, type CertificateSettings } from './settings';
export { certificateState, type CertificateState } from './validity';

/** PDFs and the seal live in the private bucket; dev may read the seal from a local folder. */
function pdfDeps(settings: CertificateSettings): PdfDeps {
	return {
		storage: r2Private,
		images: () => loadCertificateImages({ dir: CERTIFICATE_ASSETS_DIR, storage: r2Private }),
		settings,
		siteUrl: PUBLIC_SITE_URL
	};
}

/** The admin issues; the PDF and the letter go after the commit. */
export async function issueCertificateNow(
	db: LimitDb,
	actor: Actor,
	input: IssueCertificateInput,
	ip: string | null
): Promise<IssueCertificateResult> {
	const settings = await certificateSettings(db);
	const deps = { settings, send: sendMail, siteUrl: PUBLIC_SITE_URL, pdf: pdfDeps(settings) };
	return issueCertificate(db, actor, input, deps, ip);
}

export async function regenerateCertificatePdfNow(
	db: LimitDb,
	actor: Actor,
	certificateId: string,
	ip: string | null
) {
	const deps = pdfDeps(await certificateSettings(db));
	return regenerateCertificatePdf(db, actor, certificateId, deps, ip);
}
