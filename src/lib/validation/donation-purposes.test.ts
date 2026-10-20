import { describe, expect, it } from 'vitest';
import { purposeFormSchema } from './donation-purposes';

/* docs/05 section 17: title ×3 (English required), active, order. */

describe('donation purpose form', () => {
	it('title, active checkbox, order', () => {
		expect(
			purposeFormSchema.parse({ title: { en: 'Park', ru: 'Парк' }, isActive: 'on', sortOrder: '3' })
		).toEqual({ title: { en: 'Park', ru: 'Парк' }, isActive: true, sortOrder: 3 });
	});

	it('unchecked is hidden, empty order is 0', () => {
		expect(purposeFormSchema.parse({ title: { en: 'Park' } })).toEqual({
			title: { en: 'Park' },
			isActive: false,
			sortOrder: 0
		});
	});

	it('English required; order is a whole number from 0 to 9999', () => {
		expect(purposeFormSchema.safeParse({ title: { ru: 'Парк' } }).success).toBe(false);
		expect(purposeFormSchema.safeParse({}).success).toBe(false);
		for (const sortOrder of ['-1', '1.5', '10000', 'x']) {
			expect(purposeFormSchema.safeParse({ title: { en: 'P' }, sortOrder }).success, sortOrder).toBe(
				false
			);
		}
	});
});
