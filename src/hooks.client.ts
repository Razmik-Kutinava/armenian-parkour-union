import * as Sentry from '@sentry/sveltekit';
import { dev } from '$app/env';
import { SENTRY_DSN } from '$app/env/public';
import { dataCollection, scrubBreadcrumb, scrubEvent } from '#lib/monitoring/sentry.ts';

Sentry.init({
	dsn: SENTRY_DSN,
	environment: dev ? 'development' : 'production',
	tracesSampleRate: 1.0,
	dataCollection,
	beforeSend: scrubEvent,
	beforeBreadcrumb: scrubBreadcrumb
});

export const handleError = Sentry.handleErrorWithSentry();
