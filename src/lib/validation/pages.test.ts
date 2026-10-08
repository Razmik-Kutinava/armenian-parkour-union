import { describe, expect, it } from 'vitest';
import { formToObject } from './site-settings-form';
import { SYSTEM_PAGE_SLUGS, pageFormSchema } from './pages';

const BASE = 'https://media.parkour.am';
const schema = pageFormSchema(BASE);
const valid = { slug: 'summer-camp', title: { en: 'Summer camp' }, status: 'draft' };

describe('pages: system slugs (docs/02 seed, decisions.md 2026-10-08)', () => {
	it('are the six pages created by the seed script', () => {
		expect([...SYSTEM_PAGE_SLUGS].sort()).toEqual(
			['about', 'contacts', 'offer', 'privacy', 'refund-policy', 'rules'].sort()
		);
	});
});

describe('pages: admin form (docs/05 section 19)', () => {
	it('English title is required, other languages are optional', () => {
		expect(schema.safeParse(valid).success).toBe(true);
		const noEn = schema.safeParse({ ...valid, title: { ru: 'Лагерь' } });
		expect(noEn.error?.issues[0]).toMatchObject({ path: ['title', 'en'] });
	});

	it.each(['summer-camp', 'a', 'rules-2026'])('slug %s is accepted', (slug) => {
		expect(schema.safeParse({ ...valid, slug }).success).toBe(true);
	});

	it.each([
		'',
		'Summer',
		'two words',
		'-lead',
		'trail-',
		'a--b',
		'../admin',
		'ünï',
		'x'.repeat(81)
	])('slug %j is refused', (slug) => {
		const result = schema.safeParse({ ...valid, slug });
		expect(result.success).toBe(false);
		expect(result.error?.issues[0].path).toEqual(['slug']);
	});

	it('status is one of draft, published, archived', () => {
		for (const status of ['draft', 'published', 'archived']) {
			expect(schema.safeParse({ ...valid, status }).success, status).toBe(true);
		}
		expect(schema.safeParse({ ...valid, status: 'deleted' }).success).toBe(false);
	});

	it('body is cleaned per language; empty languages are left out', () => {
		const result = schema.parse({
			...valid,
			body: { en: '<p onclick="x">Hi</p><script>alert(1)</script>', hy: '<p></p>' }
		});
		expect(result.body).toEqual({ en: '<p>Hi</p>' });
	});

	it('no body at all is an empty object', () => {
		expect(schema.parse(valid).body).toEqual({});
	});

	it('images only from the media library survive', () => {
		const img = `${BASE}/media/2026/10/${crypto.randomUUID()}.png`;
		const result = schema.parse({
			...valid,
			body: { en: `<p>a<img src="${img}"><img src="https://evil.example/x.png"></p>` }
		});
		expect(result.body.en).toContain(img);
		expect(result.body.en).not.toContain('evil.example');
	});

	it('reads the form fields as sent by the admin page', () => {
		const form = new FormData();
		form.set('slug', 'camp');
		form.set('title.en', 'Camp');
		form.set('title.ru', 'Лагерь');
		form.set('body.en', '<p>Text</p>');
		form.set('status', 'published');
		expect(schema.parse(formToObject(form))).toEqual({
			slug: 'camp',
			title: { en: 'Camp', ru: 'Лагерь' },
			body: { en: '<p>Text</p>' },
			status: 'published'
		});
	});
});
