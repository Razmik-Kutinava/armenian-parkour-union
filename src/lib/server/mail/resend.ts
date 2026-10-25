import { letterHtml } from './layout';

export type Mail = { to: string; subject: string; text: string };

type Log = { info: (message: string) => void; error: (message: string) => void };

type MailerOptions = {
	apiKey: string | undefined;
	from: string | undefined;
	/** Development server: without a provider the whole letter (with its link) goes to the log. */
	dev: boolean;
	/** Footer link of the letter layout. */
	siteUrl: string | undefined;
	fetch: typeof globalThis.fetch;
	sleep: (ms: number) => Promise<void>;
	log: Log;
};

const ENDPOINT = 'https://api.resend.com/emails';
const TIMEOUT_MS = 10_000;
const PAUSES_MS = [1_000, 3_000];
const RETRY_AFTER_MAX_MS = 10_000;

type Attempt = { ok: true } | { ok: false; reason: string; retry: boolean; waitMs?: number };

function waitOf(response: Response): number | undefined {
	const seconds = Number(response.headers.get('retry-after'));
	return seconds > 0 ? Math.min(seconds * 1000, RETRY_AFTER_MAX_MS) : undefined;
}

/**
 * Task 0.10: Resend over HTTP. A failed send is logged and swallowed so registration and password
 * reset still finish; the key and the letter text (links with tokens) never reach the log.
 * Task 8.2: the brand layout goes as `html`; network errors, 429 and 5xx are tried again, with one
 * idempotency key per letter so a lost reply does not send it twice.
 */
export function createMailer({ apiKey, from, dev, siteUrl, fetch, sleep, log }: MailerOptions) {
	return async function send(mail: Mail): Promise<void> {
		if (!apiKey || !from) {
			log.info(
				dev
					? `[mail] to=${mail.to} subject="${mail.subject}"\n${mail.text}`
					: `[mail] not sent, no MAIL_API_KEY / MAIL_FROM: to=${mail.to} subject="${mail.subject}"`
			);
			return;
		}
		const headers = {
			authorization: `Bearer ${apiKey}`,
			'content-type': 'application/json',
			'idempotency-key': crypto.randomUUID()
		};
		const body = JSON.stringify({
			from,
			to: [mail.to],
			subject: mail.subject,
			text: mail.text,
			html: letterHtml(mail, siteUrl)
		});
		const attempt = async (): Promise<Attempt> => {
			try {
				const response = await fetch(ENDPOINT, {
					method: 'POST',
					headers,
					body,
					signal: AbortSignal.timeout(TIMEOUT_MS)
				});
				if (response.ok) return { ok: true };
				const retry = response.status === 429 || response.status >= 500;
				return { ok: false, reason: `Resend ${response.status}`, retry, waitMs: waitOf(response) };
			} catch (e) {
				const reason = `Resend unreachable (${e instanceof Error ? e.name : 'unknown'})`;
				return { ok: false, reason, retry: true };
			}
		};
		for (let tries = 1; ; tries++) {
			const result = await attempt();
			if (result.ok) return;
			if (!result.retry || tries > PAUSES_MS.length) {
				log.error(
					`[mail] ${result.reason}, ${tries} tries: to=${mail.to} subject="${mail.subject}"`
				);
				return;
			}
			await sleep(result.waitMs ?? PAUSES_MS[tries - 1]);
		}
	};
}
