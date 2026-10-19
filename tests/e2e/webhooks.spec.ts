import { expect, test } from '@playwright/test';

/* docs/07 section 4: outside development there is no mock, and manual has no webhooks. */
test('webhook route: mock, manual and unknown providers are 404 on a built site', async ({
	request
}) => {
	for (const provider of ['mock', 'manual', 'nope']) {
		const res = await request.post(`/api/webhooks/${provider}`, {
			data: { eventId: 'e2e', providerPaymentId: 'x', status: 'paid' },
			maxRedirects: 0
		});
		expect(res.status(), provider).toBe(404);
	}
});

test('webhook route: GET is not served', async ({ request }) => {
	const res = await request.get('/api/webhooks/mock', { maxRedirects: 0 });
	expect(res.status()).toBe(405);
});
