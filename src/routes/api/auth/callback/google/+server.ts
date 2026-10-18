import { error } from '@sveltejs/kit';
import { auth } from '#lib/server/auth/index.ts';
import { googleEnabled } from '#lib/server/auth/google.ts';
import type { RequestHandler } from './$types';

/** The only mounted Better Auth endpoint: Google returns here after sign-in. */
export const GET: RequestHandler = ({ request }) => {
	if (!googleEnabled()) error(404);
	return auth().handler(request);
};
