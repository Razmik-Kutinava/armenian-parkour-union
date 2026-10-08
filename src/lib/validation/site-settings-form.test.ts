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

	it('footer links: numbered rows become a list in form order, blank rows are dropped', () => {
		const obj = formToObject(
			form({
				...base,
				'footer.links.2.label.en': 'Partners',
				'footer.links.2.url': 'https://partners.example',
				'footer.links.0.label.en': 'Coaches',
				'footer.links.0.label.ru': 'Тренеры',
				'footer.links.0.url': '/pages/coaches',
				'footer.links.1.label.en': '',
				'footer.links.1.url': ''
			})
		);
		const r = settingsFormSchema.safeParse(obj);
		expect(r.success && r.data.footer).toEqual({
			links: [
				{ label: { en: 'Coaches', ru: 'Тренеры' }, url: '/pages/coaches' },
				{ label: { en: 'Partners' }, url: 'https://partners.example' }
			]
		});
	});

	it('footer links: https or a site path only', () => {
		const urls = ['javascript:alert(1)', 'http://x.example', '//evil.example', '/\\evil.example'];
		const fields = Object.fromEntries(
			urls.flatMap((url, i) => [
				[`footer.links.${i}.label.en`, 'Link'],
				[`footer.links.${i}.url`, url]
			])
		);
		const r = settingsFormSchema.safeParse(formToObject(form({ ...base, ...fields })));
		const errors = r.error ? settingsErrors(r.error) : {};
		urls.forEach((_, i) => expect(errors[`footer.links.${i}.url`]).toBe('settings.error.link'));
	});

	it('footer links: label in English and address are both required in a filled row', () => {
		const r = settingsFormSchema.safeParse(
			formToObject(
				form({
					...base,
					'footer.links.0.label.ru': 'Тренеры',
					'footer.links.0.url': '/pages/coaches',
					'footer.links.1.label.en': 'Partners'
				})
			)
		);
		const errors = r.error ? settingsErrors(r.error) : {};
		expect(errors['footer.links.0.label.en']).toBe('auth.error.required');
		expect(errors['footer.links.1.url']).toBe('auth.error.required');
	});

	it('footer links: at most 10', () => {
		const fields = Object.fromEntries(
			Array.from({ length: 11 }, (_, i) => [
				[`footer.links.${i}.label.en`, `L${i}`],
				[`footer.links.${i}.url`, `/l${i}`]
			]).flat()
		);
		const r = settingsFormSchema.safeParse(formToObject(form({ ...base, ...fields })));
		expect(r.success).toBe(false);
		expect(r.error && settingsErrors(r.error)['footer.links']).toBe('settings.error.tooManyLinks');
	});

	it('footer links: a non-numbered row is refused', () => {
		const r = settingsFormSchema.safeParse(
			formToObject(form({ ...base, 'footer.links.x.url': '/a', 'footer.links.x.label.en': 'A' }))
		);
		expect(r.success).toBe(false);
	});

	it('stored footer links flatten back into numbered form fields', () => {
		expect(flattenValues({ footer: { links: [{ label: { en: 'A' }, url: '/a' }] } })).toEqual({
			'footer.links.0.label.en': 'A',
			'footer.links.0.url': '/a'
		});
	});

	it('stored values flatten back into form field values', () => {
		expect(flattenValues({ contacts: { address: { en: 'A', ru: 'Б' } }, socials: {} })).toEqual({
			'contacts.address.en': 'A',
			'contacts.address.ru': 'Б'
		});
	});
});
