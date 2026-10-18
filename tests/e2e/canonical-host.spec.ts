import { expect, test } from '@playwright/test';

/* www. → bare domain is another host: SvelteKit 3 `redirect()` refuses it with a 500. */
test('www. address redirects to the bare domain, keeping path and query', async ({ request }) => {
	const res = await request.get('/events?page=2', {
		headers: { host: 'www.localhost:4173' },
		maxRedirects: 0
	});
	expect(res.status()).toBe(301);
	expect(res.headers()['location']).toBe('http://localhost:4173/events?page=2');
});
