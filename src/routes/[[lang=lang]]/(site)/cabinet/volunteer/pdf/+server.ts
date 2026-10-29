import { error } from '@sveltejs/kit';
import { PUBLIC_SITE_URL } from '$app/env/private';
import { requireUser } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { cardPdfFile } from '#lib/server/services/volunteer/card-pdf.ts';
import { publicUrl } from '#lib/server/storage/r2.ts';
import type { RequestHandler } from './$types';

/* docs/03 section 19.8: the owner's valid card in the language of the page; the id comes from the
 * session. Not issued or not valid — 404. */
export const GET: RequestHandler = async ({ locals, url }) => {
	const user = requireUser(locals.user);
	const file = await cardPdfFile(
		db,
		{ userId: user.id },
		{
			actorId: user.id,
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
