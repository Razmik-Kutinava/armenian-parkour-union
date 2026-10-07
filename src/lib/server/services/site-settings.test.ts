import { existsSync } from 'node:fs';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../auth/rate-limit';
import { siteSettings } from '../db/schema/service';
import { getFooterSettings } from './site-settings';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const url = process.env.DATABASE_URL;

class Rollback extends Error {}

describe.skipIf(!url)('footer settings from site_settings', () => {
	const client = postgres(url ?? '', { max: 1, onnotice: () => {} });
	const db = drizzle(client);
	afterAll(() => client.end());

	async function inRollback(fn: (tx: LimitDb) => Promise<void>) {
		await db
			.transaction(async (tx) => {
				await tx.delete(siteSettings);
				await fn(tx);
				throw new Rollback();
			})
			.catch((e) => {
				if (!(e instanceof Rollback)) throw e;
			});
	}

	const put = (tx: LimitDb, key: string, value: unknown) =>
		tx.insert(siteSettings).values({ key, value });

	it('returns nothing to show when the keys are absent', async () => {
		await inRollback(async (tx) => {
			expect(await getFooterSettings(tx, 'en')).toEqual({
				contacts: null,
				socials: [],
				text: null,
				requisites: null
			});
		});
	});

	it('returns contacts, socials, text and requisites in the page language', async () => {
		await inRollback(async (tx) => {
			await put(tx, 'contacts', {
				email: 'info@parkour.am',
				address: { en: 'Yerevan', ru: 'Ереван' },
				mapUrl: 'https://maps.example.com/apu'
			});
			await put(tx, 'socials', { telegram: 'https://t.me/apu', instagram: 'https://instagram.com/apu' });
			await put(tx, 'footer', { text: { en: 'Since 2010', ru: 'С 2010 года' } });
			await put(tx, 'requisites', { text: { en: 'Tax ID 000' } });

			expect(await getFooterSettings(tx, 'ru')).toEqual({
				contacts: {
					email: 'info@parkour.am',
					address: 'Ереван',
					mapUrl: 'https://maps.example.com/apu'
				},
				socials: [
					{ name: 'instagram', url: 'https://instagram.com/apu' },
					{ name: 'telegram', url: 'https://t.me/apu' }
				],
				text: 'С 2010 года',
				requisites: 'Tax ID 000'
			});
		});
	});

	it('hides a key with an invalid value and keeps the rest', async () => {
		await inRollback(async (tx) => {
			await put(tx, 'socials', { instagram: 'javascript:alert(1)' });
			await put(tx, 'contacts', { phone: '+374 10 000000' });

			const footer = await getFooterSettings(tx, 'en');
			expect(footer.socials).toEqual([]);
			expect(footer.contacts).toEqual({ phone: '+374 10 000000' });
		});
	});

	it('treats an empty contacts object as nothing to show', async () => {
		await inRollback(async (tx) => {
			await put(tx, 'contacts', {});
			expect((await getFooterSettings(tx, 'en')).contacts).toBeNull();
		});
	});
});
