import { describe, expect, it } from 'vitest';
import { missingConditions } from './access-rules';

/* docs/03 section 18.1 p. 1; decisions — docs/todo.md 9.4 (1). */

const NOW = new Date('2026-10-27T12:00:00Z');
const coach = { requiresMembership: true, minAge: 18, requiredLevel: 'advanced' as const };
const fits = { birthDate: '1990-01-01', level: 'advanced' as const };

describe('training access: course conditions', () => {
	it('an adult advanced member with a membership meets the coach course', () => {
		expect(missingConditions(coach, fits, true, NOW)).toEqual([]);
		expect(missingConditions(coach, { ...fits, level: 'pro' }, true, NOW)).toEqual([]);
	});

	it('lists everything missing in a fixed order: membership, age, level', () => {
		const young = { birthDate: '2010-05-05', level: 'novice' as const };
		expect(missingConditions(coach, young, false, NOW)).toEqual(['membership', 'age', 'level']);
	});

	it('age counts full years on the day: 18 tomorrow is not 18 yet', () => {
		expect(missingConditions(coach, { ...fits, birthDate: '2008-10-28' }, true, NOW)).toEqual([
			'age'
		]);
		expect(missingConditions(coach, { ...fits, birthDate: '2008-10-27' }, true, NOW)).toEqual([]);
	});

	it('no birth date or no level never meets a limit', () => {
		expect(missingConditions(coach, { birthDate: null, level: null }, true, NOW)).toEqual([
			'age',
			'level'
		]);
	});

	it('empty settings check nothing', () => {
		const open = { requiresMembership: false, minAge: null, requiredLevel: null };
		expect(missingConditions(open, { birthDate: null, level: null }, false, NOW)).toEqual([]);
	});
});
