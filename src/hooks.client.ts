import * as Sentry from '@sentry/sveltekit';
import type { HandleClientError } from '@sveltejs/kit/hooks';
import { dev } from '$app/env';
import { SENTRY_DSN } from '$app/env/public';
import { updated } from '$app/state';
import {
	dataCollection,
	isMissingChunk,
	scrubBreadcrumb,
	scrubEvent
} from '#lib/monitoring/sentry.ts';

Sentry.init({
	dsn: SENTRY_DSN,
	environment: dev ? 'development' : 'production',
	tracesSampleRate: 1.0,
	dataCollection,
	beforeSend: scrubEvent,
	beforeBreadcrumb: scrubBreadcrumb
});

const report = Sentry.handleErrorWithSentry<HandleClientError>();

/* A tab opened before a deploy asks for chunks the new build no longer has; SvelteKit then loads
 * the page in full, so it is not an error of the site. */
export const handleError: HandleClientError = async (input) => {
	if (isMissingChunk(input.error) && (await updated.check())) return;
	return report(input);
};
