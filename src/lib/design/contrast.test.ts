import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';
import { accentPalettes } from './palettes';

const NAVY_950 = '#0A1A2B';
const WHITE = '#FFFFFF';
const AA_TEXT = 4.5;

describe('contrastRatio', () => {
	it('matches known WCAG values', () => {
		expect(contrastRatio('#000000', WHITE)).toBeCloseTo(21, 5);
		expect(contrastRatio(WHITE, WHITE)).toBeCloseTo(1, 5);
		expect(contrastRatio('#1F4E78', WHITE)).toBeGreaterThan(8.5);
	});

	it('is symmetric', () => {
		expect(contrastRatio('#FF8A1F', NAVY_950)).toBe(contrastRatio(NAVY_950, '#FF8A1F'));
	});

	it('rejects non-hex input', () => {
		expect(() => contrastRatio('red', WHITE)).toThrow();
	});
});

describe.each(accentPalettes)('accent palette $id passes section 3.5 pairs', (p) => {
	it('accent-500 on navy-950 (button on dark)', () => {
		expect(contrastRatio(p.accent500, NAVY_950)).toBeGreaterThanOrEqual(AA_TEXT);
	});

	it('accent-700 on white (accent text on light)', () => {
		expect(contrastRatio(p.accent700, WHITE)).toBeGreaterThanOrEqual(AA_TEXT);
	});

	it('navy-950 text on accent-100 badge', () => {
		expect(contrastRatio(NAVY_950, p.accent100)).toBeGreaterThanOrEqual(AA_TEXT);
	});
});
