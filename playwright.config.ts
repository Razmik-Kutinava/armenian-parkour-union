import { defineConfig } from '@playwright/test';
import { E2E_CRON_SECRET } from './tests/e2e/cron-secret';

export default defineConfig({
	testDir: 'tests/e2e',
	/* Tests write to the database with SQL, past the admin, so the public cache would show old data.
	 * Admin-flow specs can run with the cache on: CACHE_TTL_SECONDS=60. */
	webServer: {
		command: 'npm run build && npm run preview',
		port: 4173,
		env: { CACHE_TTL_SECONDS: process.env.CACHE_TTL_SECONDS ?? '0', CRON_SECRET: E2E_CRON_SECRET }
	},
	use: { baseURL: 'http://localhost:4173' },
	reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list'
});
