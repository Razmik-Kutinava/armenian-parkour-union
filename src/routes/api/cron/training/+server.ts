import { json } from '@sveltejs/kit';
import { CRON_SECRET, PUBLIC_SITE_URL } from '$app/env/private';
import { cronAccess } from '#lib/server/auth/cron.ts';
import { db } from '#lib/server/db/index.ts';
import { sendMail } from '#lib/server/mail/index.ts';
import { runQuizDaily } from '#lib/server/services/training/quiz-daily.ts';
import type { RequestHandler } from './$types';

/** docs/03 section 18.3 p. 4: the daily call from GitHub Actions (.github/workflows/cron.yml). */
export const POST: RequestHandler = async ({ request }) => {
	const status = cronAccess(request.headers.get('authorization'), CRON_SECRET);
	if (status !== 200) return new Response(null, { status });
	const summary = await runQuizDaily(db, { send: sendMail, siteUrl: PUBLIC_SITE_URL });
	console.info('training daily:', JSON.stringify(summary));
	return json(summary);
};
