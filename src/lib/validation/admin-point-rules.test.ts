import { describe, expect, it } from 'vitest';
import { ruleFormSchema, thresholdsFormSchema, thresholdsToForm } from './admin-point-rules';

/* docs/05 section 13: title ×3 (English required), points, active; the code is not a form field.
 * Thresholds of "suspicious" (decisions.md 2026-10-21): manual on/off and three whole numbers. */

describe('point rule form', () => {
	it('reads title, points and the active box; extra fields such as code are dropped', () => {
		const parsed = ruleFormSchema.parse({
			title: { en: ' Video ', ru: 'Видео' },
			points: ' 25 ',
			isActive: 'on',
			code: 'hacked'
		});
		expect(parsed).toEqual({ title: { en: 'Video', ru: 'Видео' }, points: 25, isActive: true });
		expect(ruleFormSchema.parse({ title: { en: 'V' }, points: '0' }).isActive).toBe(false);
	});

	it('points: a whole number from 0 to 1 000 000; English title required', () => {
		for (const points of ['-1', '1.5', 'abc', '', '1000001']) {
			const result = ruleFormSchema.safeParse({ title: { en: 'V' }, points });
			expect(result.success, points).toBe(false);
			expect(result.error?.issues[0].message).toBe('pointRules.error.points');
		}
		expect(ruleFormSchema.parse({ title: { en: 'V' }, points: '1000000' }).points).toBe(1_000_000);
		expect(ruleFormSchema.safeParse({ title: { ru: 'В' }, points: '5' }).success).toBe(false);
	});
});

describe('suspicious thresholds form', () => {
	it('reads the manual box and three numbers; back to form strings', () => {
		const parsed = thresholdsFormSchema.parse({
			manual: 'on',
			minAmount: '100',
			burstCount: '5',
			burstHours: '24'
		});
		expect(parsed).toEqual({ manual: true, minAmount: 100, burstCount: 5, burstHours: 24 });
		expect(thresholdsToForm(parsed)).toEqual({
			manual: 'on',
			minAmount: '100',
			burstCount: '5',
			burstHours: '24'
		});
		const off = thresholdsFormSchema.parse({ minAmount: '1', burstCount: '2', burstHours: '1' });
		expect(off.manual).toBe(false);
		expect(thresholdsToForm(off).manual).toBe('');
	});

	it('ranges: amount 1…1 000 000 000, entries 2…1000, hours 1…720', () => {
		const ok = { minAmount: '100', burstCount: '5', burstHours: '24' };
		for (const [field, bad] of [
			['minAmount', '0'],
			['minAmount', '1000000001'],
			['burstCount', '1'],
			['burstCount', '1001'],
			['burstHours', '0'],
			['burstHours', '721'],
			['burstHours', '2.5']
		] as const) {
			const result = thresholdsFormSchema.safeParse({ ...ok, [field]: bad });
			expect(result.success, `${field}=${bad}`).toBe(false);
			expect(result.error?.issues[0].path).toEqual([field]);
		}
	});
});
