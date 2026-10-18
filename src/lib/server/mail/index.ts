import { dev } from '$app/env';
import { MAIL_API_KEY, MAIL_FROM } from '$app/env/private';
import { createMailer, type Mail } from './resend';

export type { Mail };

/** Settings are read on each send: the build imports this module without secrets. */
export function sendMail(mail: Mail): Promise<void> {
	return createMailer({
		apiKey: MAIL_API_KEY,
		from: MAIL_FROM,
		dev,
		fetch: globalThis.fetch,
		log: console
	})(mail);
}
