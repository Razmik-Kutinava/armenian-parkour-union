import { eq } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { siteSettings } from '../../db/schema/service';

const MAX_WAIT_MINUTES = 24 * 60;

/** `null` — not set or broken: no payment then. */
export function parseWaitMinutes(value: unknown): number | null {
	return typeof value === 'number' &&
		Number.isInteger(value) &&
		value >= 1 &&
		value <= MAX_WAIT_MINUTES
		? value
		: null;
}

/** `site_settings.payment_wait_minutes`: how long a fee or donation payment waits at the provider. */
export async function paymentWaitMinutes(db: LimitDb): Promise<number | null> {
	const [row] = await db
		.select({ value: siteSettings.value })
		.from(siteSettings)
		.where(eq(siteSettings.key, 'payment_wait_minutes'));
	return parseWaitMinutes(row?.value);
}
