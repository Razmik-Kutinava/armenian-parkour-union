import { PUBLIC_SITE_URL } from '$app/env/private';
import type { LimitDb } from '../../auth/rate-limit';
import { sendMail } from '../../mail';
import type { Actor } from '../users/target';
import { issueCertificate, type IssueCertificateInput, type IssueCertificateResult } from './issue';
import { certificateSettings } from './settings';

/* docs/05 section 8: routes call these; settings come from `site_settings.certificates`. */

export type { IssueCertificateInput, IssueCertificateResult, IssueRefusal } from './issue';
export { CERTIFICATE_CATEGORY_MAX, CERTIFICATE_COMMENT_MAX } from './issue-input';
export { certificateTitleKey } from './mail';
export { revokeCertificate, type RevokeInput, type RevokeOutcome } from './revoke';
export { certificateSettings, type CertificateSettings } from './settings';
export { certificateState, type CertificateState } from './validity';

/** The admin issues; the letter goes after the commit. */
export async function issueCertificateNow(
	db: LimitDb,
	actor: Actor,
	input: IssueCertificateInput,
	ip: string | null
): Promise<IssueCertificateResult> {
	const deps = {
		settings: await certificateSettings(db),
		send: sendMail,
		siteUrl: PUBLIC_SITE_URL
	};
	return issueCertificate(db, actor, input, deps, ip);
}
