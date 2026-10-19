import { describe, expect, it } from 'vitest';
import { readBody } from './webhook-body';

const URL = 'https://parkour.test/api/webhooks/mock';

const streamed = (chunks: string[]) =>
	new Request(URL, {
		method: 'POST',
		body: new ReadableStream({
			start(controller) {
				for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
				controller.close();
			}
		}),
		duplex: 'half'
	} as RequestInit);

describe('webhook body with a size limit', () => {
	it('returns the exact text within the limit', async () => {
		const body = '{"a": "б"}\n';
		expect(await readBody(new Request(URL, { method: 'POST', body }), 64)).toBe(body);
		expect(await readBody(streamed(['{"a":', ' 1}']), 64)).toBe('{"a": 1}');
	});

	it('counts bytes, not characters', async () => {
		const body = 'ббб';
		expect(await readBody(new Request(URL, { method: 'POST', body }), 6)).toBe(body);
		expect(await readBody(new Request(URL, { method: 'POST', body }), 5)).toBeNull();
	});

	it('refuses by content-length before reading', async () => {
		const request = new Request(URL, {
			method: 'POST',
			headers: { 'content-length': '1000' },
			body: 'x'
		});
		expect(await readBody(request, 10)).toBeNull();
	});

	it('refuses a stream that grows past the limit without content-length', async () => {
		expect(await readBody(streamed(['12345', '67890', 'x']), 10)).toBeNull();
	});

	it('an empty body is an empty string', async () => {
		expect(await readBody(new Request(URL, { method: 'POST' }), 10)).toBe('');
	});
});
