import { PUBLIC_SITE_URL } from '$app/env/private';
import type { LimitDb } from '../../auth/rate-limit';
import { sendMail } from '../../mail';
import type { Actor } from '../users/target';
import { approveConsent, rejectConsent, type ReviewResult } from './review';

export { consentListOptions, getConsentCard, listConsents } from './admin-list';
export { completeConsentUpload, signConsentUpload } from './files';
export { getOwnConsents } from './own';
export { hasValidConsent } from './valid';
export type { ReviewResult };

/* The review actions wired to the real mail. */

export const approve = (
	db: LimitDb,
	actor: Actor,
	id: string,
	input: { validUntil: Date | null },
	ip: string | null
): Promise<ReviewResult> =>
	approveConsent(db, actor, id, input, { send: sendMail, siteUrl: PUBLIC_SITE_URL, ip });

export const reject = (
	db: LimitDb,
	actor: Actor,
	id: string,
	input: { note: string },
	ip: string | null
): Promise<ReviewResult> =>
	rejectConsent(db, actor, id, input, { send: sendMail, siteUrl: PUBLIC_SITE_URL, ip });
