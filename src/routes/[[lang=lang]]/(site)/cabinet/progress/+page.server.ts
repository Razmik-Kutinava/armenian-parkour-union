import { error } from '@sveltejs/kit';
import { PUBLIC_SITE_URL } from '$app/env/private';
import { requireUser } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { getOwnProgress } from '#lib/server/services/cabinet/progress.ts';
import { qrSvg } from '#lib/server/services/certificates/qr-svg.ts';
import { examSettings } from '#lib/server/services/exams/settings.ts';
import type { PageServerLoad } from './$types';

/* docs/06 section 5.5: own data only, the user id from the session. The verify link and the QR are
 * the address printed in the PDF (no language prefix); a revoked certificate gets neither. */
export const load: PageServerLoad = async ({ locals, setHeaders, url }) => {
	const user = requireUser(locals.user);
	setHeaders({ 'cache-control': 'no-store' });
	const progress = await getOwnProgress(db, user.id, await examSettings(db));
	if (!progress) error(404, 'Not found');
	const site = PUBLIC_SITE_URL || url.origin;
	const certificates = progress.certificates.map(({ publicToken, ...cert }) => {
		if (cert.state === 'revoked') return { ...cert, verifyPath: null, verifyUrl: null, qr: null };
		const verifyPath = `/certificate/${publicToken}`;
		const verifyUrl = new URL(verifyPath, site).href;
		return { ...cert, verifyPath, verifyUrl, qr: qrSvg(verifyUrl) };
	});
	return { ...progress, certificates };
};
