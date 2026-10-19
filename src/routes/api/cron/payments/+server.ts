import { json } from '@sveltejs/kit';
import { CRON_SECRET } from '$app/env/private';
import { cronAccess } from '#lib/server/auth/cron.ts';
import { db } from '#lib/server/db/index.ts';
import { reconcileNow } from '#lib/server/services/payments/index.ts';
import type { RequestHandler } from './$types';

/** docs/07 section 7 p. 2: the hourly call from GitHub Actions (.github/workflows/cron.yml). */
export const POST: RequestHandler = async ({ request }) => {
	const status = cronAccess(request.headers.get('authorization'), CRON_SECRET);
	if (status !== 200) return new Response(null, { status });
	return json(await reconcileNow(db));
};
