import { afterAll, describe, expect, it } from 'vitest';
import { siteSettings } from '../../db/schema/service';
import { testDb, testDbUrl } from '../../db/test-db';
import { getSeoBase } from './base';

/* docs/05 section 21: the site name and SEO description come from site settings. */
describe.skipIf(!testDbUrl)('seo: site name and description from settings', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('the stored name and description in the language asked, English when missing', async () => {
		await inRollback(async (tx) => {
			await tx.delete(siteSettings);
			await tx.insert(siteSettings).values([
				{ key: 'site_name', value: { en: 'APU', ru: 'Союз паркура' } },
				{ key: 'seo_description', value: { en: 'Parkour in Armenia' } },
				{ key: 'locales', value: { enabled: ['en', 'ru'] } }
			]);
			expect(await getSeoBase(tx, 'ru', 'https://parkour.am')).toEqual({
				siteUrl: 'https://parkour.am',
				siteName: 'Союз паркура',
				locale: 'ru',
				description: 'Parkour in Armenia',
				locales: ['en', 'ru']
			});
		});
	});

	it('missing or broken keys fall back to the translations', async () => {
		await inRollback(async (tx) => {
			await tx.delete(siteSettings);
			await tx.insert(siteSettings).values({ key: 'site_name', value: 'not an object' });
			const base = await getSeoBase(tx, 'en', 'https://parkour.am');
			expect(base.siteName).toBe('Armenian Parkour Union');
			expect(base.description).toBe(
				'Armenian Parkour Union: events, news, membership and certification.'
			);
			expect(base.locales).toEqual(['en', 'hy', 'ru']);
		});
	});
});
