import { describe, expect, it } from 'vitest';
import {
	flattenValues,
	formToObject,
	settingsErrors,
	settingsFormSchema
} from './site-settings-form';

const form = (entries: Record<string, string>) => {
	const data = new FormData();
	for (const [k, v] of Object.entries(entries)) data.append(k, v);
	return data;
};
const base = {
	'site_name.en': 'Armenian Parkour Union',
	'seo_description.en': 'Parkour in Armenia'
};

describe('site settings form (docs/05 section 21)', () => {
	it('dotted names become nested objects, blank fields are dropped', () => {
		const obj = formToObject(
			form({
				...base,
				'contacts.phone': ' +374 10 000000 ',
				'contacts.address.en': '',
				'socials.instagram': ''
			})
		);
		expect(obj).toEqual({
			site_name: { en: 'Armenian Parkour Union' },
			seo_description: { en: 'Parkour in Armenia' },
			contacts: { phone: '+374 10 000000' }
		});
	});

	it('empty groups are saved as empty objects', () => {
		const r = settingsFormSchema.safeParse(formToObject(form(base)));
		expect(r.success && r.data).toEqual({
			site_name: { en: 'Armenian Parkour Union' },
			seo_description: { en: 'Parkour in Armenia' },
			contacts: {},
			socials: {},
			footer: {},
			requisites: {}
		});
	});

	it('English is required where another language is filled; errors carry the full field name', () => {
		const r = settingsFormSchema.safeParse(
			formToObject(
				form({ 'seo_description.en': 'x', 'site_name.ru': 'Союз', 'footer.text.hy': 'Տեքստ' })
			)
		);
		expect(r.success).toBe(false);
		const errors = r.error ? settingsErrors(r.error) : {};
		expect(errors['site_name.en']).toBe('auth.error.required');
		expect(errors['footer.text.en']).toBe('auth.error.required');
	});

	it('links: https only', () => {
		const bad = settingsFormSchema.safeParse(
			formToObject(
				form({
					...base,
					'socials.youtube': 'javascript:alert(1)',
					'contacts.mapUrl': 'http://maps.example'
				})
			)
		);
		const errors = bad.error ? settingsErrors(bad.error) : {};
		expect(errors['socials.youtube']).toBe('settings.error.url');
		expect(errors['contacts.mapUrl']).toBe('settings.error.url');
	});

	it('unknown fields never reach the stored value', () => {
		const r = settingsFormSchema.safeParse(
			formToObject(form({ ...base, 'contacts.evil': 'x', 'other.key': 'y' }))
		);
		expect(r.success && r.data.contacts).toEqual({});
		expect(r.success && 'other' in r.data).toBe(false);
	});

	it('stored values flatten back into form field values', () => {
		expect(flattenValues({ contacts: { address: { en: 'A', ru: 'Б' } }, socials: {} })).toEqual({
			'contacts.address.en': 'A',
			'contacts.address.ru': 'Б'
		});
	});
});
