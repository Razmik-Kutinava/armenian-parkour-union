import { describe, expect, it, vi } from 'vitest';
import { createMailer } from './resend';

const mail = {
	to: 'a@example.com',
	subject: 'Confirm',
	text: 'Open https://x/verify?token=SECRET'
};

function setup(options: { apiKey?: string; from?: string; dev?: boolean; status?: number }) {
	const fetch = vi.fn(async () => new Response('{}', { status: options.status ?? 200 }));
	const log = { info: vi.fn(), error: vi.fn() };
	const send = createMailer({
		apiKey: options.apiKey,
		from: options.from,
		dev: options.dev ?? false,
		fetch,
		log
	});
	const logged = () => JSON.stringify([...log.info.mock.calls, ...log.error.mock.calls]);
	return { send, fetch, log, logged };
}

describe('createMailer (task 0.10, Resend)', () => {
	it('with a key and sender sends to Resend with the key in the header', async () => {
		const { send, fetch, logged } = setup({ apiKey: 're_key', from: 'APU <noreply@parkour.am>' });
		await send(mail);
		expect(fetch).toHaveBeenCalledOnce();
		const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe('https://api.resend.com/emails');
		expect(init.method).toBe('POST');
		expect(new Headers(init.headers).get('authorization')).toBe('Bearer re_key');
		expect(JSON.parse(String(init.body))).toEqual({
			from: 'APU <noreply@parkour.am>',
			to: ['a@example.com'],
			subject: 'Confirm',
			text: mail.text
		});
		expect(logged()).not.toContain('SECRET');
	});

	it('Resend error is logged without the key or the text and does not throw', async () => {
		const { send, log, logged } = setup({ apiKey: 're_key', from: 'x@parkour.am', status: 422 });
		await expect(send(mail)).resolves.toBeUndefined();
		expect(log.error).toHaveBeenCalled();
		expect(logged()).not.toContain('re_key');
		expect(logged()).not.toContain('SECRET');
	});

	it('network failure does not throw', async () => {
		const log = { info: vi.fn(), error: vi.fn() };
		const fetch = vi.fn(async () => {
			throw new Error('offline');
		});
		const send = createMailer({ apiKey: 'k', from: 'f@parkour.am', dev: false, fetch, log });
		await expect(send(mail)).resolves.toBeUndefined();
		expect(log.error).toHaveBeenCalled();
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
