import { describe, expect, it } from 'vitest';
import { amountPresets } from './donation-presets';

/* docs/06 section 4.8: quick amounts come from the limits in the settings, not from the code. */

describe('donation quick amounts', () => {
	it('minimum ×1, ×5, ×10, ×20', () => {
		expect(amountPresets(1000, 1_000_000)).toEqual([1000, 5000, 10_000, 20_000]);
	});

	it('only amounts within the maximum, no duplicates', () => {
		expect(amountPresets(1000, 7000)).toEqual([1000, 5000]);
		expect(amountPresets(500, 500)).toEqual([500]);
	});
});
