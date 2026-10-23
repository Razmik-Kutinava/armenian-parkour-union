import { expect, test, type APIRequestContext } from '@playwright/test';
import { E2E_CRON_SECRET } from './cron-secret';

/* docs/07 section 7 p. 2: the hourly external call; only with `CRON_SECRET`. A POST without a
 * JSON content type is a form for SvelteKit and is refused as cross-site (403) before the route. */
const URL = '/api/cron/payments';

const call = (request: APIRequestContext, token?: string) =>
	request.post(URL, {
		headers: token ? { authorization: `Bearer ${token}` } : {},
		data: {},
		maxRedirects: 0
	});

test('cron: without the token or with a wrong one — 401, nothing runs', async ({ request }) => {
	expect((await call(request)).status()).toBe(401);
	expect((await call(request, `${E2E_CRON_SECRET}-wrong`)).status()).toBe(401);
});

test('cron: the right token runs reconciliation and returns its counters', async ({ request }) => {
	const res = await call(request, E2E_CRON_SECRET);
	expect(res.status()).toBe(200);
	expect(await res.json()).toEqual({
		checked: expect.any(Number),
		applied: expect.any(Number),
		expired: expect.any(Number),
		flagged: expect.any(Number),
		failed: expect.any(Number),
		released: expect.any(Number)
	});
});

test('cron: GET is not served', async ({ request }) => {
	const res = await request.get(URL, { maxRedirects: 0 });
	expect(res.status()).toBe(405);
});
