import { error } from '@sveltejs/kit';
import { PUBLIC_SITE_URL } from '$app/env/private';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { cardPdfFile } from '#lib/server/services/volunteer/card-pdf.ts';
import { publicUrl } from '#lib/server/storage/r2.ts';
import type { RequestHandler } from './$types';

/* docs/03 section 19.8 p. 2, docs/05 section 28 "Cards": an admin downloads a valid card from its
 * page, in the admin's language; not issued or not valid — 404 (docs/03 section 19.2 p. 3). */
export const GET: RequestHandler = async ({ locals, params, url }) => {
	const actor = requirePermission(locals.user, 'volunteer.manage');
	const file = await cardPdfFile(
		db,
		{ cardId: params.id },
		{
			actorId: actor.id,
			locale: locals.locale,
			siteUrl: PUBLIC_SITE_URL ?? url.origin,
			toUrl: publicUrl
		}
	);
	if (!file.ok && file.reason === 'limited') error(429, 'Too many requests');
	if (!file.ok) error(404, 'Not found');
	return new Response(file.bytes, {
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': `attachment; filename="${file.number}.pdf"`,
			'cache-control': 'no-store'
		}
	});
};
