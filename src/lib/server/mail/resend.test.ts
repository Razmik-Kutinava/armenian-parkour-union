import { describe, expect, it, vi } from 'vitest';
import { createMailer } from './resend';

const mail = {
	to: 'a@example.com',
	subject: 'Confirm',
	text: 'Open https://x/verify?token=SECRET'
};

type Reply = number | Error | { status: number; retryAfter: string };

function setup(options: { apiKey?: string; from?: string; dev?: boolean; replies?: Reply[] }) {
	const replies = [...(options.replies ?? [200])];
	const fetch = vi.fn(async () => {
		const reply = replies.length > 1 ? replies.shift()! : replies[0];
		if (reply instanceof Error) throw reply;
		if (typeof reply === 'number') return new Response('{}', { status: reply });
		return new Response('{}', { status: reply.status, headers: { 'retry-after': reply.retryAfter } });
	});
	const log = { info: vi.fn(), error: vi.fn() };
	const sleep = vi.fn(async () => {});
	const send = createMailer({
		apiKey: options.apiKey,
		from: options.from,
		dev: options.dev ?? false,
		siteUrl: 'https://parkour.am',
		fetch,
		sleep,
		log
	});
	const logged = () => JSON.stringify([...log.info.mock.calls, ...log.error.mock.calls]);
	const sent = (i: number) => fetch.mock.calls[i] as unknown as [string, RequestInit];
	return { send, fetch, log, sleep, logged, sent };
}

const keyed = { apiKey: 're_key', from: 'APU <noreply@parkour.am>' };

describe('createMailer (task 0.10, Resend)', () => {
	it('with a key and sender sends to Resend with the key in the header', async () => {
		const { send, fetch, logged, sent } = setup(keyed);
		await send(mail);
		expect(fetch).toHaveBeenCalledOnce();
		const [url, init] = sent(0);
		expect(url).toBe('https://api.resend.com/emails');
		expect(init.method).toBe('POST');
		expect(new Headers(init.headers).get('authorization')).toBe('Bearer re_key');
		expect(JSON.parse(String(init.body))).toMatchObject({
			from: 'APU <noreply@parkour.am>',
			to: ['a@example.com'],
			subject: 'Confirm',
			text: mail.text
		});
		expect(logged()).not.toContain('SECRET');
	});

	it('Resend error is logged without the key or the text and does not throw', async () => {
		const { send, log, logged } = setup({ ...keyed, replies: [422] });
		await expect(send(mail)).resolves.toBeUndefined();
		expect(log.error).toHaveBeenCalled();
		expect(logged()).not.toContain('re_key');
		expect(logged()).not.toContain('SECRET');
	});

	it('no key in development: the whole letter goes to the log', async () => {
		const { send, fetch, logged } = setup({ dev: true });
		await send(mail);
		expect(fetch).not.toHaveBeenCalled();
		expect(logged()).toContain('SECRET');
	});

	it('no key or no sender in a built app: only address and subject are logged', async () => {
		for (const options of [{}, { apiKey: 're_key' }, { from: 'x@parkour.am' }]) {
			const { send, fetch, logged } = setup({ dev: false, ...options });
			await send(mail);
			expect(fetch).not.toHaveBeenCalled();
			expect(logged()).toContain('a@example.com');
			expect(logged()).not.toContain('SECRET');
		}
	});
});

describe('createMailer (task 8.2, template and retries)', () => {
	it('sends the branded HTML version along with the text', async () => {
		const { send, sent } = setup(keyed);
		await send(mail);
		const body = JSON.parse(String(sent(0)[1].body));
		expect(body.text).toBe(mail.text);
		expect(body.html).toContain('Armenian Parkour Union');
		expect(body.html).toContain('<a href="https://x/verify?token=SECRET"');
	});

	it('a server error is retried with the same idempotency key', async () => {
		const { send, fetch, log, sleep, sent } = setup({ ...keyed, replies: [503, 200] });
		await send(mail);
		expect(fetch).toHaveBeenCalledTimes(2);
		expect(sleep).toHaveBeenCalledWith(1000);
		const key = (i: number) => new Headers(sent(i)[1].headers).get('idempotency-key');
		expect(key(0)).toBeTruthy();
		expect(key(1)).toBe(key(0));
		expect(log.error).not.toHaveBeenCalled();
	});

	it('each letter gets its own idempotency key', async () => {
		const { send, sent } = setup(keyed);
		await send(mail);
		await send(mail);
		const key = (i: number) => new Headers(sent(i)[1].headers).get('idempotency-key');
		expect(key(1)).not.toBe(key(0));
	});

	it('rate limit waits as long as Retry-After says, at most 10 seconds', async () => {
		const first = setup({ ...keyed, replies: [{ status: 429, retryAfter: '2' }, 200] });
		await first.send(mail);
		expect(first.sleep).toHaveBeenCalledWith(2000);
		const second = setup({ ...keyed, replies: [{ status: 429, retryAfter: '600' }, 200] });
		await second.send(mail);
		expect(second.sleep).toHaveBeenCalledWith(10_000);
	});

	it('network failure is tried 3 times, logged once and does not throw', async () => {
		const { send, fetch, log, sleep, logged } = setup({ ...keyed, replies: [new Error('offline')] });
		await expect(send(mail)).resolves.toBeUndefined();
		expect(fetch).toHaveBeenCalledTimes(3);
		expect(sleep.mock.calls).toEqual([[1000], [3000]]);
		expect(log.error).toHaveBeenCalledOnce();
		expect(logged()).not.toContain('SECRET');
		expect(logged()).not.toContain('re_key');
	});

	it('a rejected letter (4xx other than 429) is not retried', async () => {
		const { send, fetch, sleep } = setup({ ...keyed, replies: [422] });
		await send(mail);
		expect(fetch).toHaveBeenCalledOnce();
		expect(sleep).not.toHaveBeenCalled();
	});
});
