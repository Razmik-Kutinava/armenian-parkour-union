import { defineConfig } from '@playwright/test';
import { E2E_CRON_SECRET } from './tests/e2e/cron-secret';

export default defineConfig({
	testDir: 'tests/e2e',
	globalSetup: './tests/e2e/global-setup.ts',
	/* Tests write to the database with SQL, past the admin, so the public cache would show old data.
	 * Admin-flow specs can run with the cache on: CACHE_TTL_SECONDS=60.
	 * MAIL_API_KEY is emptied: test addresses at example.com must not reach Resend. */
	webServer: {
		command: 'npm run build && npm run preview',
		port: 4173,
		/* The build alone takes most of the default minute on a busy machine. */
		timeout: 180_000,
		env: {
			CACHE_TTL_SECONDS: process.env.CACHE_TTL_SECONDS ?? '0',
			CRON_SECRET: E2E_CRON_SECRET,
			MAIL_API_KEY: ''
		}
	},
	/* Locally the database is remote (Neon, ~70 ms a query) and six workers share one preview
	 * server: sign-up alone can take longer than the default 5 s, a long flow longer than 30 s. */
	timeout: 60_000,
	expect: { timeout: 10_000 },
	use: { baseURL: 'http://localhost:4173' },
	reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list'
});
