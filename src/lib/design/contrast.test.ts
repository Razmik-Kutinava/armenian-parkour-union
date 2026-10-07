import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';

const css = readFileSync(new URL('../../app.css', import.meta.url), 'utf8');

function token(name: string): string {
	const match = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6});`).exec(css);
	if (!match) throw new Error(`Token --${name} not found in app.css`);
	return match[1];
}

const AA_TEXT = 4.5;

describe('contrastRatio', () => {
	it('matches known WCAG values', () => {
		expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
		expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
	});

	it('is symmetric', () => {
		expect(contrastRatio('#FF8A1F', '#0A1A2B')).toBe(contrastRatio('#0A1A2B', '#FF8A1F'));
	});

	it('rejects non-hex input', () => {
		expect(() => contrastRatio('red', '#FFFFFF')).toThrow();
	});
});

describe('app.css text pairs (08-DESIGN, section 3.5)', () => {
	const pairs: [fg: string, bg: string, min: number][] = [
		['surface', 'navy-700', AA_TEXT],
		['surface', 'navy-900', AA_TEXT],
		['accent-500', 'navy-950', AA_TEXT],
		['navy-950', 'accent-100', AA_TEXT],
		['ink-900', 'surface', AA_TEXT],
		['ink-700', 'surface', AA_TEXT],
		['ink-500', 'surface', AA_TEXT],
		['accent-700', 'surface', AA_TEXT],
		['success-fg', 'success-bg', AA_TEXT],
		['warning-fg', 'warning-bg', AA_TEXT],
		['error-fg', 'error-bg', AA_TEXT],
		['surface', 'error-strong', AA_TEXT]
	];

	it.each(pairs)('%s on %s', (fg, bg, min) => {
		expect(contrastRatio(token(fg), token(bg))).toBeGreaterThanOrEqual(min);
	});
});
