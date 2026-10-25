import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { sentrySvelteKit } from '@sentry/sveltekit/vite';
import { csp } from './csp.config.ts';

/* Source maps go up only from the Deploy build (Docker build secret); a Sentry outage never fails it. */
const sentry = () =>
	sentrySvelteKit({
		org: 'llc-manageengine',
		project: 'parkour-am',
		authToken: process.env.SENTRY_AUTH_TOKEN,
		autoUploadSourceMaps: Boolean(process.env.SENTRY_AUTH_TOKEN),
		release: { name: process.env.SENTRY_RELEASE || undefined },
		telemetry: false,
		errorHandler: (error) => console.warn('sentry: source maps not uploaded', error)
	});

/* Tests that change `points_rules` (`setRules`) hold its table lock until their rollback: a new
 * such file goes here, or it queues on the others until the timeout. */
const RULES_TESTS = [
	'src/lib/server/services/points/{award,reverse,invariants,rules-admin}.test.ts',
	'src/lib/server/services/registrations/points*.test.ts',
	'src/lib/server/services/cabinet/points.test.ts',
	'src/lib/server/services/certificates/points.test.ts',
	'src/lib/server/services/videos/{review,race}.test.ts',
	'src/lib/server/seed/points-rules.test.ts'
];

/* An issue holds the certificate number lock until the test's rollback: in parallel these files
 * only queue on each other until the timeout. `certificates/points.test.ts` stays with the rules. */
const ISSUE_TESTS = [
	'src/lib/server/services/certificates/{issue,issue-level,issue-mail,revoke,number,pdf-store,daily,race,race-level}.test.ts',
	'src/lib/server/services/staff/profile.test.ts'
];

/* Same for an order: it holds the order number lock until the test's rollback. */
const ORDER_TESTS = [
	'src/lib/server/services/shop/{checkout,checkout-refusals,order-cancel,order-cancel-own,race,race-cancel}.test.ts'
];

export default defineConfig({
	plugins: [
		tailwindcss(),
		process.env.VITEST ? [] : sentry(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter(),
			csp,
			tracing: { server: true }
		})
	],
	test: {
		expect: { requireAssertions: true },
		passWithNoTests: true,
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					// Database tests go to the remote Neon dev database; 5 s is too tight in parallel.
					testTimeout: 20_000,
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: [
						'src/**/*.svelte.{test,spec}.{js,ts}',
						'src/lib/server/services/hero/**',
						...RULES_TESTS,
						...ISSUE_TESTS,
						...ORDER_TESTS
					]
				}
			},
			{
				extends: './vite.config.ts',
				test: {
					name: 'server-orders',
					environment: 'node',
					testTimeout: 20_000,
					fileParallelism: false,
					include: ORDER_TESTS
				}
			},
			{
				extends: './vite.config.ts',
				test: {
					name: 'server-certificates',
					environment: 'node',
					testTimeout: 20_000,
					fileParallelism: false,
					include: ISSUE_TESTS
				}
			},
			{
				extends: './vite.config.ts',
				test: {
					// Same as hero: in parallel these files only queue on the rules lock until the timeout.
					name: 'server-points',
					environment: 'node',
					testTimeout: 20_000,
					fileParallelism: false,
					include: RULES_TESTS
				}
			},
			{
				extends: './vite.config.ts',
				test: {
					// Hero tests empty the shared table and hold the active-limit lock: files in parallel
					// only queue on each other's transactions until the timeout.
					name: 'server-hero',
					environment: 'node',
					testTimeout: 20_000,
					fileParallelism: false,
					include: ['src/lib/server/services/hero/**/*.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
