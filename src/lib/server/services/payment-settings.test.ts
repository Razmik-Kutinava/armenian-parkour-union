import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../auth/rate-limit';
import { auditLog, siteSettings } from '../db/schema/service';
import { insertUser, testDb, testDbUrl } from '../db/test-db';
import { donationSettings } from './donations/settings';
import { membershipFee, membershipPeriodMonths } from './memberships/fee';
import { getPaymentSettings, savePaymentSettings } from './payment-settings';
import { paymentWaitMinutes } from './payments/settings';
import { saveSettings } from './site-settings';

const IP = '198.51.100.11';
const KEYS = ['membership_fee', 'donation_limits', 'payment_wait_minutes'];
const values = {
	membership_fee: { amount_minor: 25_000, currency: 'AMD' as const, period_months: 6 },
	donation_limits: { currency: 'AMD' as const, min_minor: 2000, max_minor: 500_000 },
	payment_wait_minutes: 45
};

describe.skipIf(!testDbUrl)('payment settings in the admin panel (docs/05 section 21)', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	const admin = async (tx: LimitDb) => ({
		id: (await insertUser(tx, { role: 'admin' })).id,
		role: 'admin' as const
	});
	const auditBy = (tx: LimitDb, actorId: string) =>
		tx
			.select()
			.from(auditLog)
			.where(and(eq(auditLog.actorId, actorId), eq(auditLog.action, 'settings.update')));
	const resetKeys = async (tx: LimitDb) => {
		await tx.delete(siteSettings).where(inArray(siteSettings.key, KEYS));
		await tx.insert(siteSettings).values([
			{ key: 'membership_fee', value: { amount_minor: 0, currency: 'AMD', period_months: 12 } },
			{ key: 'donation_limits', value: { currency: 'AMD', min_minor: 1000, max_minor: 1_000_000 } },
			{ key: 'payment_wait_minutes', value: 30 }
		]);
	};

	it('saves the keys; the payment scenarios read the new values at once', async () => {
		await inRollback(async (tx) => {
			const actor = await admin(tx);
			await resetKeys(tx);
			expect(await savePaymentSettings(tx, actor, values, IP)).toBe('ok');

			expect(await getPaymentSettings(tx)).toEqual(values);
			expect(await membershipFee(tx)).toEqual({
				amountMinor: 25_000,
				currency: 'AMD',
				periodMonths: 6
			});
			expect((await donationSettings(tx)).limits).toEqual({
				currency: 'AMD',
				minMinor: 2000,
				maxMinor: 500_000
			});
			expect(await paymentWaitMinutes(tx)).toBe(45);
			const [row] = await tx
				.select()
				.from(siteSettings)
				.where(eq(siteSettings.key, 'membership_fee'));
			expect(row.updatedBy).toBe(actor.id);
		});
	});

	it('every changed key is logged with before and after; unchanged keys are not', async () => {
		await inRollback(async (tx) => {
			const actor = await admin(tx);
			await resetKeys(tx);
			await savePaymentSettings(
				tx,
				actor,
				{ ...values, donation_limits: { currency: 'AMD', min_minor: 1000, max_minor: 1_000_000 } },
				IP
			);
			const entries = await auditBy(tx, actor.id);
			expect(entries).toHaveLength(2);
			const fee = entries.find((e) => (e.after as Record<string, unknown>).membership_fee);
			expect(fee).toMatchObject({
				entityType: 'site_settings',
				before: { membership_fee: { amount_minor: 0, currency: 'AMD', period_months: 12 } },
				after: { membership_fee: values.membership_fee },
				ip: IP
			});
			const wait = entries.find((e) => 'payment_wait_minutes' in (e.after as object));
			expect(wait).toMatchObject({
				before: { payment_wait_minutes: 30 },
				after: { payment_wait_minutes: 45 }
			});

			expect(await savePaymentSettings(tx, actor, values, IP)).toBe('ok');
			expect(await auditBy(tx, actor.id)).toHaveLength(3);
			expect(await savePaymentSettings(tx, actor, values, IP)).toBe('ok');
			expect(await auditBy(tx, actor.id)).toHaveLength(3);
		});
	});

	it('a fee of 0 switches the fee off but keeps the term', async () => {
		await inRollback(async (tx) => {
			const actor = await admin(tx);
			await resetKeys(tx);
			const off = { ...values, membership_fee: { ...values.membership_fee, amount_minor: 0 } };
			expect(await savePaymentSettings(tx, actor, off, IP)).toBe('ok');
			expect(await membershipFee(tx)).toBeNull();
			expect(await membershipPeriodMonths(tx)).toBe(6);
		});
	});

	it('only an admin saves (docs/04: settings.write); nothing changes otherwise', async () => {
		await inRollback(async (tx) => {
			await resetKeys(tx);
			for (const role of ['member', 'editor', 'moderator'] as const) {
				const user = await insertUser(tx, { role });
				expect(await savePaymentSettings(tx, { id: user.id, role }, values, IP)).toBe(
					'not_admin'
				);
				expect(await auditBy(tx, user.id)).toHaveLength(0);
			}
			expect(await paymentWaitMinutes(tx)).toBe(30);
		});
	});

	it('a broken or missing stored key is left out of the form', async () => {
		await inRollback(async (tx) => {
			await tx.delete(siteSettings).where(inArray(siteSettings.key, KEYS));
			await tx.insert(siteSettings).values([
				{ key: 'membership_fee', value: { amount_minor: -5, currency: 'AMD', period_months: 12 } },
				{ key: 'payment_wait_minutes', value: 20 }
			]);
			expect(await getPaymentSettings(tx)).toEqual({ payment_wait_minutes: 20 });
		});
	});

	it('the site form does not touch the payment keys', async () => {
		await inRollback(async (tx) => {
			const actor = await admin(tx);
			await resetKeys(tx);
			await savePaymentSettings(tx, actor, values, IP);
			const site = {
				site_name: { en: 'APU' },
				seo_description: { en: 'Parkour' },
				contacts: {},
				socials: {},
				footer: {},
				requisites: {}
			};
			expect(await saveSettings(tx, actor, site, IP)).toBe('ok');
			expect(await getPaymentSettings(tx)).toEqual(values);
		});
	});
});
