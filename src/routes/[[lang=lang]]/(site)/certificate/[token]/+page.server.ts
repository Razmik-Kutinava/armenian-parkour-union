import { error } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.ts';
import { certificateTitleKey } from '#lib/server/services/certificates/mail.ts';
import { findPublicCertificate } from '#lib/server/services/certificates/public.ts';
import type { PageServerLoad } from './$types';

/* docs/06 section 4.10: the QR from the PDF leads here. Not cached — a revoke shows at once. */
export const load: PageServerLoad = async ({ params, setHeaders }) => {
	const certificate = await findPublicCertificate(db, params.token);
	if (!certificate) error(404, 'Not Found');
	setHeaders({ 'cache-control': 'no-store', 'x-robots-tag': 'noindex' });
	const level = certificate.level === 'novice' ? null : certificate.level;
	return { certificate, title: certificateTitleKey({ kind: certificate.kind, level }) };
};
