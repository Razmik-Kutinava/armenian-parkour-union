import { expect, test, type APIRequestContext } from '@playwright/test';
import { E2E_CRON_SECRET } from './cron-secret';

/* docs/03 section 4.6, 5.3: the daily coach and judge certificate job; only with `CRON_SECRET`. */
const URL = '/api/cron/certificates';

const call = (request: APIRequestContext, token?: string) =>
	request.post(URL, {
		headers: token ? { authorization: `Bearer ${token}` } : {},
		data: {},
		maxRedirects: 0
	});

test('certificate job: without the token or with a wrong one — 401', async ({ request }) => {
	expect((await call(request)).status()).toBe(401);
	expect((await call(request, `${E2E_CRON_SECRET}-wrong`)).status()).toBe(401);
});

test('certificate job: the right token runs it and returns its counters', async ({ request }) => {
	const res = await call(request, E2E_CRON_SECRET);
	expect(res.status()).toBe(200);
	expect(await res.json()).toEqual({
		expired: expect.any(Number),
		deactivated: expect.any(Number),
		reminded: expect.any(Number)
	});
});

test('certificate job: GET is not served', async ({ request }) => {
	const res = await request.get(URL, { maxRedirects: 0 });
	expect(res.status()).toBe(405);
});
