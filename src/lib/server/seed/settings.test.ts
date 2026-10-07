import { eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { settingsFormSchema } from '#lib/validation/site-settings-form.ts';
import { siteSettings } from '../db/schema/service';
import { testDb, testDbUrl } from '../db/test-db';
import { SEED_SETTINGS, seedSettings } from './settings';

/* docs/02 section 10: keys of site_settings created by the seed script. */
const KEYS = [
	'contacts',
	'feature_flags',
	'footer',
	'membership_fee',
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

	it('membership fee: integer minor units, AMD, 12 months, amount not set yet', () => {
		expect(SEED_SETTINGS.membership_fee).toEqual({
			amount_minor: 0,
			currency: 'AMD',
			period_months: 12
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
