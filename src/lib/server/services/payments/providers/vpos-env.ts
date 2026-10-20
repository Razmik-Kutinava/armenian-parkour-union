import { createVposProvider, type VposProvider } from './vpos';

export type VposEnv = { token?: string; webhookSecret?: string; livemode?: string };

/** docs/07 section 14 p. 1, 4: `PAYMENT_VPOS_*`; without both keys, or live in development — none. */
export function vposFromEnv(
	{ token, webhookSecret, livemode }: VposEnv,
	{ dev, fetch }: { dev: boolean; fetch: typeof globalThis.fetch }
): VposProvider | null {
	if (!token || !webhookSecret) return null;
	const live = livemode === 'true';
	if (live && dev) {
		console.error('PAYMENT_VPOS_LIVEMODE=true is not allowed in development: VPOS is off');
		return null;
	}
	return createVposProvider({ token, webhookSecret, livemode: live, fetch });
}
