import type { OnlineProvider } from './types';

export type VposOptions = {
	token: string;
	webhookSecret: string;
	livemode: boolean;
	fetch: typeof globalThis.fetch;
	now?: () => Date;
};

export type VposProvider = OnlineProvider & Required<Pick<OnlineProvider, 'parseWebhook' | 'refund'>>;

export function createVposProvider(options: VposOptions): VposProvider {
	void options;
	throw new Error('not implemented');
}
