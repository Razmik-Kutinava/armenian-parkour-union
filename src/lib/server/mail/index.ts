import { dev } from '$app/env';
import { MAIL_API_KEY, MAIL_FROM, PUBLIC_SITE_URL } from '$app/env/private';
import { createMailer, type Mail } from './resend';

export type { Mail };

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Settings are read on each send: the build imports this module without secrets. */
export function sendMail(mail: Mail): Promise<void> {
	return createMailer({
		apiKey: MAIL_API_KEY,
		from: MAIL_FROM,
		dev,
		siteUrl: PUBLIC_SITE_URL,
		fetch: globalThis.fetch,
		sleep,
		log: console
	})(mail);
}
