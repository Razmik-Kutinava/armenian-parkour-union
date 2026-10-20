import type { VposProvider } from './vpos';

export type VposEnv = { token?: string; webhookSecret?: string; livemode?: string };

export function vposFromEnv(
	env: VposEnv,
	options: { dev: boolean; fetch: typeof globalThis.fetch }
): VposProvider | null {
	void env;
	void options;
	return null;
}
