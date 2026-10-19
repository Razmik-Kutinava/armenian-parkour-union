import { eq } from 'drizzle-orm';
import { dev } from '$app/env';
import { PAYMENT_PROVIDER } from '$app/env/private';
import type { LimitDb } from '../../../auth/rate-limit';
import { siteSettings } from '../../../db/schema/service';
import { onlinePaymentsEnabled, paymentProviders } from './registry';
import type { OnlineProvider, PaymentProvider } from './types';

export * from './types';

/** Provider of an existing payment (`payments.provider`); `null` — unknown or not allowed here. */
export function providerById(id: string): PaymentProvider | null {
	return paymentProviders.get(id, { dev });
}

/** Where a new online payment goes; `null` — online payment is off. */
export async function onlineProvider(db: LimitDb): Promise<OnlineProvider | null> {
	if (!PAYMENT_PROVIDER) return null;
	const [flags] = await db
		.select({ value: siteSettings.value })
		.from(siteSettings)
		.where(eq(siteSettings.key, 'feature_flags'));
	return paymentProviders.online({
		configured: PAYMENT_PROVIDER,
		dev,
		enabled: onlinePaymentsEnabled(flags?.value)
	});
}
