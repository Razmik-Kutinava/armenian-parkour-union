import { describe, expect, it } from 'vitest';
import { staffProfileSchema } from './admin-staff';

/* docs/05 section 9 and section 1 item 4: category, license, description ×3 (English first),
 * public, active. Participant and kind are not in the form. Messages are i18n keys. */

const form = (extra: Record<string, string> = {}) => ({
	category: ' Category A ',
	licenseNumber: 'LIC-1',
	bioEn: 'Coach',
	bioHy: '',
	bioRu: 'Тренер',
	isPublic: 'on',
	isActive: 'on',
	...extra
});
const parse = (f: Record<string, string>) => staffProfileSchema.safeParse(f);
const errorOf = (r: ReturnType<typeof parse>) =>
	r.success ? null : Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message]));

describe('admin staff: profile form', () => {
	it('trims, keeps filled languages, reads the boxes', () => {
		const r = parse(form());
		expect(r.success && r.data).toEqual({
			category: 'Category A',
			licenseNumber: 'LIC-1',
			bio: { en: 'Coach', ru: 'Тренер' },
			isPublic: true,
			isActive: true
		});
	});

	it('empty fields are null; an unchecked box sends nothing and is false', () => {
		const r = parse({ category: '', licenseNumber: ' ', bioEn: '', bioHy: '', bioRu: '' });
		expect(r.success && r.data).toEqual({
			category: null,
			licenseNumber: null,
			bio: null,
			isPublic: false,
			isActive: false
		});
	});

	it('Armenian or Russian without English: error at English', () => {
		expect(errorOf(parse(form({ bioEn: '', bioHy: 'Մարզիչ', bioRu: '' })))).toEqual({
			bioEn: 'staff.error.bioEn'
		});
	});

	it('limits: category 100, license 60, description 2000', () => {
		expect(errorOf(parse(form({ category: 'x'.repeat(101) })))).toEqual({
			category: 'auth.error.tooLong'
		});
		expect(errorOf(parse(form({ licenseNumber: 'x'.repeat(61) })))).toEqual({
			licenseNumber: 'auth.error.tooLong'
		});
		expect(errorOf(parse(form({ bioRu: 'x'.repeat(2001) })))).toEqual({
			bioRu: 'auth.error.tooLong'
		});
		expect(parse(form({ category: 'x'.repeat(100), bioEn: 'x'.repeat(2000) })).success).toBe(true);
	});

	it('participant and kind in the form are ignored', () => {
		const r = parse({ ...form(), userId: crypto.randomUUID(), kind: 'judge' });
		expect(r.success && Object.keys(r.data)).toEqual([
			'category',
			'licenseNumber',
			'bio',
			'isPublic',
			'isActive'
		]);
	});
});
