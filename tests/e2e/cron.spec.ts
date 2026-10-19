import { expect, test } from '@playwright/test';
import { E2E_CRON_SECRET } from './cron-secret';

/* docs/07 section 7 p. 2: the hourly external call; only with `CRON_SECRET`. */
const URL = '/api/cron/payments';

test('cron: without the token or with a wrong one — 401, nothing runs', async ({ request }) => {
	for (const headers of [{}, { authorization: `Bearer ${E2E_CRON_SECRET}-wrong` }]) {
		const res = await request.post(URL, { headers, maxRedirects: 0 });
		expect(res.status()).toBe(401);
	}
});

test('cron: the right token runs reconciliation and returns its counters', async ({ request }) => {
	const res = await request.post(URL, {
		headers: { authorization: `Bearer ${E2E_CRON_SECRET}` },
		maxRedirects: 0
	});
	expect(res.status()).toBe(200);
	expect(await res.json()).toEqual({
		checked: expect.any(Number),
		applied: expect.any(Number),
		expired: expect.any(Number),
		flagged: expect.any(Number),
		failed: expect.any(Number)
	});
});

test('cron: GET is not served', async ({ request }) => {
	const res = await request.get(URL, { maxRedirects: 0 });
	expect(res.status()).toBe(405);
});
