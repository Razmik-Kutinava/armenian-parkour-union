import { json } from '@sveltejs/kit';
import { CRON_SECRET, PUBLIC_SITE_URL } from '$app/env/private';
import { cronAccess } from '#lib/server/auth/cron.ts';
import { db } from '#lib/server/db/index.ts';
import { sendMail } from '#lib/server/mail/index.ts';
import { closeDueRequests } from '#lib/server/services/volunteer/invite-close.ts';
import type { RequestHandler } from './$types';

/** docs/03 section 19.5 p. 4: daily close of volunteer requests past respond_by. */
export const POST: RequestHandler = async ({ request }) => {
	const status = cronAccess(request.headers.get('authorization'), CRON_SECRET);
	if (status !== 200) return new Response(null, { status });
	const summary = await closeDueRequests(db, new Date(), {
		send: sendMail,
		siteUrl: PUBLIC_SITE_URL
	});
	console.info('volunteer daily:', JSON.stringify(summary));
	return json(summary);
};
