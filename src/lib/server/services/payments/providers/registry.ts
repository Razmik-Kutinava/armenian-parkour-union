import { dev } from '$app/env';
import {
	PAYMENT_VPOS_API_TOKEN,
	PAYMENT_VPOS_LIVEMODE,
	PAYMENT_VPOS_WEBHOOK_SECRET
} from '$app/env/private';
import { manualProvider } from './manual';
import { createMockProvider } from './mock';
import { PaymentConfigError, type OnlineProvider, type PaymentProvider } from './types';
import { vposFromEnv } from './vpos-env';

type Entry = { provider: PaymentProvider; devOnly?: boolean };
type Env = { dev: boolean };
type OnlineConfig = Env & {
	/** `PAYMENT_PROVIDER`; empty — online payment is not set up. */
	configured: string | undefined;
	/** `feature_flags.payments_online`: switches online payment off without a deploy. */
	enabled: boolean;
};

export function createRegistry(entries: Entry[]) {
	const byId = new Map(entries.map((entry) => [entry.provider.id, entry]));

	/** By `payments.provider`: webhooks and status checks of payments already created. */
	function get(id: string, { dev }: Env): PaymentProvider | null {
		const entry = byId.get(id);
		return entry && (dev || !entry.devOnly) ? entry.provider : null;
	}

	/** The provider new online payments go to; a wrong `PAYMENT_PROVIDER` fails loudly. */
	function online({ configured, dev, enabled }: OnlineConfig): OnlineProvider | null {
		if (!configured) return null;
		const provider = get(configured, { dev });
		if (!provider?.online) {
			throw new PaymentConfigError(`PAYMENT_PROVIDER=${configured} is not available here`);
		}
		return enabled ? provider : null;
	}

	return { get, online };
}

/** Anything but an explicit `false` keeps online payment on: the env variable is the main switch. */
export function onlinePaymentsEnabled(flags: unknown): boolean {
	if (!flags || typeof flags !== 'object') return true;
	return (flags as Record<string, unknown>).payments_online !== false;
}

const vpos = vposFromEnv(
	{
		token: PAYMENT_VPOS_API_TOKEN,
		webhookSecret: PAYMENT_VPOS_WEBHOOK_SECRET,
		livemode: PAYMENT_VPOS_LIVEMODE
	},
	{ dev, fetch: (...args) => globalThis.fetch(...args) }
);

/* docs/07 section 4: mock exists only in development. One instance per process keeps its state. */
export const paymentProviders = createRegistry([
	{ provider: manualProvider },
	{ provider: createMockProvider(), devOnly: true },
	...(vpos ? [{ provider: vpos }] : [])
]);
