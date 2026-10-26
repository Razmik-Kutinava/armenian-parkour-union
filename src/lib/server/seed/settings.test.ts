import { eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { settingsFormSchema } from '#lib/validation/site-settings-form.ts';
import { siteSettings } from '../db/schema/service';
import { testDb, testDbUrl } from '../db/test-db';
import { SEED_SETTINGS, seedSettings } from './settings';

/* docs/02 section 10: keys of site_settings created by the seed script. */
const KEYS = [
	'certificates',
	'contacts',
	'donation_limits',
	'event_registration',
	'exams',
	'feature_flags',
	'footer',
	'hero_max_active',
	'membership_fee',
	'payment_wait_minutes',
	'points_suspicious',
	'requisites',
	'site_name',
	'socials'
];

describe('seed: site_settings values', () => {
	it('has every key from docs/02 and the site name', () => {
		expect(Object.keys(SEED_SETTINGS).sort()).toEqual(KEYS);
	});

	it('values pass the same schemas as the admin form', () => {
		const shape = settingsFormSchema.shape;
		for (const key of ['site_name', 'contacts', 'socials', 'footer', 'requisites'] as const) {
			expect(shape[key].safeParse(SEED_SETTINGS[key]).success, key).toBe(true);
		}
	});

	it('hero limit: 5 active blocks (docs/03 section 11)', () => {
		expect(SEED_SETTINGS.hero_max_active).toBe(5);
	});

	it('membership fee: integer minor units, AMD, 12 months, amount not set yet', () => {
		expect(SEED_SETTINGS.membership_fee).toEqual({
			amount_minor: 0,
			currency: 'AMD',
			period_months: 12
		});
	});

	it('payment wait: 30 minutes for the fee and donations (decisions.md 2026-10-19, 3.6)', () => {
		expect(SEED_SETTINGS.payment_wait_minutes).toBe(30);
	});

	it('donation limits: AMD, 1 000 to 1 000 000 (decisions.md 2026-10-19, 3.7)', () => {
		expect(SEED_SETTINGS.donation_limits).toEqual({
			currency: 'AMD',
			min_minor: 1000,
			max_minor: 1_000_000
		});
	});

	it('event registration: hold 30 min, 48 h to pay after the waitlist, cancel until the start', () => {
		expect(SEED_SETTINGS.event_registration).toEqual({
			hold_minutes: 30,
			offer_hours: 48,
			cancel_hours: 0
		});
	});

	it('exams: no wait before a retake, no minimum time on a level (docs/03 section 16)', () => {
		expect(SEED_SETTINGS.exams).toEqual({ retake_days: 0, min_days_on_level: 0 });
	});

	it('certificates: coach and judge valid 24 months, Russian in the PDF, letters 30 and 7 days ahead, the head signs (docs/03 4.6, 16; 08 10; questions.md stage 6)', () => {
		expect(SEED_SETTINGS.certificates).toEqual({
			staff_valid_months: 24,
			pdf_russian: true,
			staff_remind_days: [30, 7],
			signer: {
				name: { hy: 'Ռազմիկ Գյուրջյան', en: 'Razmik Giurdzian', ru: 'Размик Гюрджян' },
				title: {
					hy: 'ֆեդերացիայի ղեկավար',
					en: 'Head of the Federation',
					ru: 'руководитель федерации'
				}
			}
		});
	});

	it('suspicious points: manual, |amount| ≥ 100, ≥ 5 entries in 24 h (decisions.md 2026-10-21)', () => {
		expect(SEED_SETTINGS.points_suspicious).toEqual({
			manual: true,
			min_amount: 100,
			burst_count: 5,
			burst_hours: 24
		});
	});
});

describe.skipIf(!testDbUrl)('seed: site_settings in the database', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('adds missing keys only and never overwrites values set by the owner', async () => {
		await inRollback(async (tx) => {
			await tx.delete(siteSettings).where(inArray(siteSettings.key, KEYS));
			const owner = { phone: '+374 10 000000' };
			await tx.insert(siteSettings).values({ key: 'contacts', value: owner });

			const added = await seedSettings(tx);
			expect(added.sort()).toEqual(KEYS.filter((k) => k !== 'contacts'));
			const [contacts] = await tx
				.select()
				.from(siteSettings)
				.where(eq(siteSettings.key, 'contacts'));
			expect(contacts.value).toEqual(owner);

			expect(await seedSettings(tx)).toEqual([]);
		});
	});
});
