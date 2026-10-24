import { describe, expect, it } from 'vitest';
import { EXAM_DEFAULTS, parseExamSettings } from './settings';

/* docs/03 section 3.3, 4.2, 16: both values are "to be set", by default without a limit. */

describe('exams: settings', () => {
	it('defaults: no wait before a retake, no minimum time on a level', () => {
		expect(EXAM_DEFAULTS).toEqual({ retakeDays: 0, minDaysOnLevel: 0 });
	});

	it('reads the stored snake_case value', () => {
		expect(parseExamSettings({ retake_days: 30, min_days_on_level: 180 })).toEqual({
			retakeDays: 30,
			minDaysOnLevel: 180
		});
	});

	it('missing or broken — the defaults', () => {
		for (const value of [
			undefined,
			null,
			'30',
			[],
			{},
			{ retake_days: -1, min_days_on_level: 0 },
			{ retake_days: 1.5, min_days_on_level: 0 },
			{ retake_days: 0, min_days_on_level: 3651 }
		]) {
			expect(parseExamSettings(value), JSON.stringify(value)).toEqual(EXAM_DEFAULTS);
		}
	});
});
