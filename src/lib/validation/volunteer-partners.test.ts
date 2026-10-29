import { describe, expect, it } from 'vitest';
import { partnerFormSchema, partnerMoveSchema, perkFormSchema } from './volunteer-partners';

/* docs/05 section 28 "Partners", docs/02 section 12: partner and perk forms. */

const errorAt = (result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
	result.error?.issues.map((i) => i.path.join('.'));

describe('volunteer partner form', () => {
	it('name, logo, site, address ×3, status; empty optional fields are null', () => {
		expect(
			partnerFormSchema.parse({
				name: ' Coffee Lab ',
				logoKey: 'media/2026/10/logo.png',
				website: 'https://coffee.am',
				address: { en: 'Abovyan 1', ru: 'Абовяна 1' },
				status: 'published'
			})
		).toEqual({
			name: 'Coffee Lab',
			logoKey: 'media/2026/10/logo.png',
			website: 'https://coffee.am',
			address: { en: 'Abovyan 1', ru: 'Абовяна 1' },
			status: 'published'
		});
		expect(
			partnerFormSchema.parse({ name: 'Gym', logoKey: '', website: '', status: 'draft' })
		).toEqual({ name: 'Gym', logoKey: null, website: null, address: null, status: 'draft' });
	});

	it('refuses: no name, a link that is not http(s), not a library key, address without English, unknown status', () => {
		const base = { name: 'Gym', status: 'draft' };
		expect(errorAt(partnerFormSchema.safeParse({ ...base, name: ' ' }))).toEqual(['name']);
		for (const website of ['javascript:alert(1)', 'ftp://x.am', 'coffee.am']) {
			expect(errorAt(partnerFormSchema.safeParse({ ...base, website })), website).toEqual([
				'website'
			]);
		}
		expect(errorAt(partnerFormSchema.safeParse({ ...base, logoKey: '../x.png' }))).toEqual([
			'logoKey'
		]);
		expect(errorAt(partnerFormSchema.safeParse({ ...base, address: { ru: 'Абовяна' } }))).toEqual([
			'address.en'
		]);
		expect(errorAt(partnerFormSchema.safeParse({ ...base, status: 'deleted' }))).toEqual([
			'status'
		]);
	});

	it('move: a partner id and up or down', () => {
		const partnerId = crypto.randomUUID();
		expect(partnerMoveSchema.parse({ partnerId, direction: 'up' })).toEqual({
			partnerId,
			direction: 'up'
		});
		expect(partnerMoveSchema.safeParse({ partnerId, direction: 'left' }).success).toBe(false);
		expect(partnerMoveSchema.safeParse({ partnerId: 'x', direction: 'up' }).success).toBe(false);
	});
});

describe('volunteer perk form', () => {
	const base = { title: { en: '10% off' }, kind: 'reusable', status: 'draft' };

	it('reusable: no limit kept even if typed; empty dates and terms are null; order 0', () => {
		expect(perkFormSchema.parse({ ...base, usesLimit: '3', validFrom: '', validUntil: '' })).toEqual(
			{
				title: { en: '10% off' },
				terms: null,
				kind: 'reusable',
				usesLimit: null,
				validFrom: null,
				validUntil: null,
				status: 'draft',
				sortOrder: 0
			}
		);
	});

	it('single: limit 1…100 required; terms ×3; a date range', () => {
		expect(
			perkFormSchema.parse({
				...base,
				kind: 'single',
				usesLimit: '2',
				terms: { en: 'Show the QR', hy: 'Ցույց տվեք QR' },
				validFrom: '2026-11-01',
				validUntil: '2026-11-01',
				sortOrder: '5'
			})
		).toMatchObject({
			kind: 'single',
			usesLimit: 2,
			terms: { en: 'Show the QR', hy: 'Ցույց տվեք QR' },
			validFrom: '2026-11-01',
			validUntil: '2026-11-01',
			sortOrder: 5
		});
		for (const usesLimit of ['', '0', '101', '1.5']) {
			expect(
				errorAt(perkFormSchema.safeParse({ ...base, kind: 'single', usesLimit })),
				usesLimit
			).toEqual(['usesLimit']);
		}
	});

	it('refuses: no English title, terms without English, a day that does not exist, until before from, unknown kind', () => {
		expect(errorAt(perkFormSchema.safeParse({ ...base, title: { ru: 'Скидка' } }))).toEqual([
			'title.en'
		]);
		expect(errorAt(perkFormSchema.safeParse({ ...base, terms: { ru: 'Условия' } }))).toEqual([
			'terms.en'
		]);
		expect(errorAt(perkFormSchema.safeParse({ ...base, validFrom: '2026-02-30' }))).toEqual([
			'validFrom'
		]);
		expect(
			errorAt(
				perkFormSchema.safeParse({ ...base, validFrom: '2026-11-02', validUntil: '2026-11-01' })
			)
		).toEqual(['validUntil']);
		expect(errorAt(perkFormSchema.safeParse({ ...base, kind: 'gift' }))).toEqual(['kind']);
	});
});
