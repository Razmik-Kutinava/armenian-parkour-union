import { describe, expect, it } from 'vitest';
import { formToObject } from './site-settings-form';
import { parseTags, postFormSchema, toYerevanInput } from './posts';

const BASE = 'https://media.parkour.am';
const schema = postFormSchema(BASE);
const valid = { slug: 'jam-2026', title: { en: 'Jam 2026' }, status: 'draft' };

describe('posts: admin form (docs/05 section 18)', () => {
	it('English title is required; excerpt, text, cover, tags, date and author are optional', () => {
		expect(schema.parse(valid)).toEqual({
			...valid,
			excerpt: {},
			body: {},
			coverKey: null,
			tags: [],
			publishedAt: null,
			authorId: null
		});
		const noEn = schema.safeParse({ ...valid, title: { ru: 'Джем' } });
		expect(noEn.error?.issues[0]).toMatchObject({ path: ['title', 'en'] });
	});

	it.each(['', 'Jam', 'two words', '-a', 'a--b', '../admin', 'x'.repeat(81)])(
		'slug %j is refused',
		(slug) => {
			expect(schema.safeParse({ ...valid, slug }).error?.issues[0].path).toEqual(['slug']);
		}
	);

	it('status is one of draft, published, archived', () => {
		for (const status of ['draft', 'published', 'archived']) {
			expect(schema.safeParse({ ...valid, status }).success, status).toBe(true);
		}
		expect(schema.safeParse({ ...valid, status: 'scheduled' }).success).toBe(false);
	});

	it('excerpt is plain text up to 300 characters in any language', () => {
		const ok = schema.parse({ ...valid, excerpt: { hy: 'Կարճ', ru: 'Коротко' } });
		expect(ok.excerpt).toEqual({ hy: 'Կարճ', ru: 'Коротко' });
		const long = schema.safeParse({ ...valid, excerpt: { en: 'x'.repeat(301) } });
		expect(long.error?.issues[0].path).toEqual(['excerpt', 'en']);
	});

	it('body is cleaned per language, only library images survive', () => {
		const img = `${BASE}/media/2026/10/${crypto.randomUUID()}.png`;
		const result = schema.parse({
			...valid,
			body: { en: `<p onclick="x">Hi<img src="${img}"><img src="https://evil.example/a.png"></p>` }
		});
		expect(result.body.en).toContain(img);
		expect(result.body.en).not.toContain('evil.example');
		expect(result.body.en).not.toContain('onclick');
	});

	it('cover is a media library key, nothing else', () => {
		const key = `media/2026/10/${crypto.randomUUID()}.webp`;
		expect(schema.parse({ ...valid, coverKey: key }).coverKey).toBe(key);
		for (const bad of [
			'https://evil.example/a.png',
			'../media/a.png',
			'media/../x',
			'avatars/a.png'
		]) {
			expect(schema.safeParse({ ...valid, coverKey: bad }).success, bad).toBe(false);
		}
	});

	it('author is a user id', () => {
		const id = crypto.randomUUID();
		expect(schema.parse({ ...valid, authorId: id }).authorId).toBe(id);
		expect(schema.safeParse({ ...valid, authorId: 'me' }).success).toBe(false);
	});

	it('publication date is Yerevan time (UTC+4) from the date-time field', () => {
		const result = schema.parse({ ...valid, publishedAt: '2026-10-08T12:30' });
		expect(result.publishedAt?.toISOString()).toBe('2026-10-08T08:30:00.000Z');
		for (const bad of ['2026-13-01T10:00', 'tomorrow', '2026-10-08']) {
			expect(schema.safeParse({ ...valid, publishedAt: bad }).success, bad).toBe(false);
		}
	});

	it('the stored date goes back to the field in Yerevan time', () => {
		expect(toYerevanInput(new Date('2026-10-08T08:30:00Z'))).toBe('2026-10-08T12:30');
		expect(toYerevanInput(new Date('2026-12-31T22:05:00Z'))).toBe('2027-01-01T02:05');
	});

	it('reads the form fields as sent by the admin page', () => {
		const form = new FormData();
		form.set('slug', 'jam');
		form.set('title.en', 'Jam');
		form.set('excerpt.en', 'Short');
		form.set('body.en', '<p>Text</p>');
		form.set('tags', 'Kids, jam');
		form.set('status', 'published');
		form.set('publishedAt', '2026-10-08T12:30');
		form.set('coverKey', '');
		expect(schema.parse(formToObject(form))).toMatchObject({
			slug: 'jam',
			title: { en: 'Jam' },
			excerpt: { en: 'Short' },
			body: { en: '<p>Text</p>' },
			tags: ['kids', 'jam'],
			status: 'published',
			coverKey: null
		});
	});
});

describe('posts: tags (decision 2.4: one language, lower case)', () => {
	it('trims, lowercases, drops empty and repeated tags, keeps the order', () => {
		expect(parseTags(' Kids,  JAM ,, kids, Street   Workout ')).toEqual([
			'kids',
			'jam',
			'street workout'
		]);
		expect(parseTags('')).toEqual([]);
	});

	it('at most 10 tags of 32 characters', () => {
		const eleven = Array.from({ length: 11 }, (_, i) => `t${i}`).join(',');
		expect(schema.safeParse({ ...valid, tags: eleven }).error?.issues[0].path).toEqual(['tags']);
		expect(schema.safeParse({ ...valid, tags: 'x'.repeat(33) }).error?.issues[0].path).toEqual([
			'tags'
		]);
		expect(schema.parse({ ...valid, tags: 'x'.repeat(32) }).tags).toEqual(['x'.repeat(32)]);
	});
});
