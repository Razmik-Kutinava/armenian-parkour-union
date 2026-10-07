import { describe, expect, it } from 'vitest';
import { contactsSchema, footerSchema, requisitesSchema, socialsSchema } from './site-settings';

describe('site_settings: contacts', () => {
	it('accepts the full set and an empty object', () => {
		const full = {
			email: 'info@parkour.am',
			phone: '+374 10 000000',
			address: { en: 'Yerevan', ru: 'Ереван' },
			mapUrl: 'https://maps.example.com/apu'
		};
		expect(contactsSchema.parse(full)).toEqual(full);
		expect(contactsSchema.parse({})).toEqual({});
	});

	it('rejects a non-https map link and a bad email', () => {
		expect(contactsSchema.safeParse({ mapUrl: 'javascript:alert(1)' }).success).toBe(false);
		expect(contactsSchema.safeParse({ mapUrl: 'http://maps.example.com' }).success).toBe(false);
		expect(contactsSchema.safeParse({ email: 'not-an-email' }).success).toBe(false);
	});

	it('requires English in a localized address', () => {
		expect(contactsSchema.safeParse({ address: { ru: 'Ереван' } }).success).toBe(false);
	});
});

describe('site_settings: socials', () => {
	it('accepts https links of the five networks', () => {
		const socials = {
			instagram: 'https://instagram.com/apu',
			youtube: 'https://youtube.com/@apu',
			telegram: 'https://t.me/apu',
			facebook: 'https://facebook.com/apu',
			tiktok: 'https://tiktok.com/@apu'
		};
		expect(socialsSchema.parse(socials)).toEqual(socials);
	});

	it('rejects script and plain-http links', () => {
		expect(socialsSchema.safeParse({ instagram: 'javascript:alert(1)' }).success).toBe(false);
		expect(socialsSchema.safeParse({ youtube: 'http://youtube.com/apu' }).success).toBe(false);
	});
});

describe('site_settings: footer and requisites', () => {
	it('take a localized text with English required', () => {
		expect(footerSchema.parse({ text: { en: 'Since 2010' } })).toEqual({
			text: { en: 'Since 2010' }
		});
		expect(requisitesSchema.safeParse({ text: { hy: 'ՀՎՀՀ' } }).success).toBe(false);
	});
});
