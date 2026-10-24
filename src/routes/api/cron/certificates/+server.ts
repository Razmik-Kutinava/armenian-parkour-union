import { json } from '@sveltejs/kit';
import { CRON_SECRET } from '$app/env/private';
import { cronAccess } from '#lib/server/auth/cron.ts';
import { publicCache } from '#lib/server/cache/index.ts';
import { db } from '#lib/server/db/index.ts';
import { certificateDailyNow } from '#lib/server/services/certificates/index.ts';
import type { RequestHandler } from './$types';

/** docs/03 section 4.6, 5.3: the daily call from GitHub Actions (.github/workflows/cron.yml). */
export const POST: RequestHandler = async ({ request }) => {
	const status = cronAccess(request.headers.get('authorization'), CRON_SECRET);
	if (status !== 200) return new Response(null, { status });
	const summary = await certificateDailyNow(db);
	if (summary.deactivated > 0) publicCache.invalidate(['staff']);
	return json(summary);
};
