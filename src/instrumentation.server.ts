import * as Sentry from '@sentry/sveltekit';
import { dev } from '$app/env';
import { SENTRY_DSN } from '$app/env/public';
import { dataCollection, scrubBreadcrumb, scrubEvent } from '#lib/monitoring/sentry.ts';

/* No DSN (development, tests, e2e) — the SDK stays off. Webhook, payment and letter failures are
 * logged with console.warn / console.error, so the console integration sends them as issues. */
Sentry.init({
	dsn: SENTRY_DSN,
	environment: dev ? 'development' : 'production',
	tracesSampleRate: 1.0,
	dataCollection,
	integrations: [Sentry.captureConsoleIntegration({ levels: ['warn', 'error'] })],
	beforeSend: scrubEvent,
	beforeBreadcrumb: scrubBreadcrumb
});
