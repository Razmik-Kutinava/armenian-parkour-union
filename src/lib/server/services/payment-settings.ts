import { inArray } from 'drizzle-orm';
import {
	paymentSettingKeys,
	storedPaymentSettings,
	type PaymentSettingsValues
} from '#lib/validation/payment-settings.ts';
import type { LimitDb } from '../auth/rate-limit';
import { siteSettings } from '../db/schema/service';
import { writeSettings } from './site-settings';
import type { Actor } from './users/target';

/* docs/05 section 21 "Membership": fee, donation limits, payment wait (decisions.md 2026-10-19). */

/** Stored values for the admin form; a broken or missing key is left out (its fields stay empty). */
export async function getPaymentSettings(db: LimitDb): Promise<Partial<PaymentSettingsValues>> {
	const rows = await db
		.select()
		.from(siteSettings)
		.where(inArray(siteSettings.key, paymentSettingKeys));
	const result: Partial<Record<keyof PaymentSettingsValues, unknown>> = {};
	for (const key of paymentSettingKeys) {
		const row = rows.find((r) => r.key === key);
		const parsed = row && storedPaymentSettings.shape[key].safeParse(row.value);
		if (parsed?.success) result[key] = parsed.data;
	}
	return result as Partial<PaymentSettingsValues>;
}

/** Admin only (docs/04: settings.write); payments already started keep their amount and wait. */
export async function savePaymentSettings(
	db: LimitDb,
	actor: Actor,
	values: PaymentSettingsValues,
	ip: string | null
): Promise<'ok' | 'not_admin'> {
	if (actor.role !== 'admin') return 'not_admin';
	await writeSettings(db, actor, values, ip);
	return 'ok';
}
