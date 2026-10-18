export type Mail = { to: string; subject: string; text: string };

type Log = { info: (message: string) => void; error: (message: string) => void };

type MailerOptions = {
	apiKey: string | undefined;
	from: string | undefined;
	/** Development server: without a provider the whole letter (with its link) goes to the log. */
	dev: boolean;
	fetch: typeof globalThis.fetch;
	log: Log;
};

const ENDPOINT = 'https://api.resend.com/emails';
const TIMEOUT_MS = 10_000;

/**
 * Task 0.10: Resend over HTTP. A failed send is logged and swallowed so registration and password
 * reset still finish; the key and the letter text (links with tokens) never reach the log.
 */
export function createMailer({ apiKey, from, dev, fetch, log }: MailerOptions) {
	return async function send(mail: Mail): Promise<void> {
		if (!apiKey || !from) {
			log.info(
				dev
					? `[mail] to=${mail.to} subject="${mail.subject}"\n${mail.text}`
					: `[mail] not sent, no MAIL_API_KEY / MAIL_FROM: to=${mail.to} subject="${mail.subject}"`
			);
			return;
		}
		try {
			const response = await fetch(ENDPOINT, {
				method: 'POST',
				headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
				body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, text: mail.text }),
				signal: AbortSignal.timeout(TIMEOUT_MS)
			});
			if (!response.ok) {
				log.error(`[mail] Resend ${response.status}: to=${mail.to} subject="${mail.subject}"`);
			}
		} catch (e) {
			const reason = e instanceof Error ? e.name : 'unknown';
			log.error(`[mail] Resend unreachable (${reason}): to=${mail.to} subject="${mail.subject}"`);
		}
	};
}
