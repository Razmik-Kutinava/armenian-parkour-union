import { describe, expect, it } from 'vitest';
import { paymentStatus } from '../../db/schema/enums';
import { canTransition } from './transitions';

/* docs/07 section 10: every other transition is forbidden; refunded is final. */

const allowed = [
	['pending', 'paid'],
	['pending', 'failed'],
	['pending', 'cancelled'],
	['paid', 'refunded'],
	['failed', 'paid'],
	['cancelled', 'paid']
];

describe('payment status transitions (docs/07 section 10)', () => {
	it('allows exactly the transitions of the table', () => {
		for (const from of paymentStatus.enumValues) {
			for (const to of paymentStatus.enumValues) {
				const expected = allowed.some(([a, b]) => a === from && b === to);
				expect(canTransition(from, to), `${from} -> ${to}`).toBe(expected);
			}
		}
	});

	it('refunded is final and nothing goes back to pending', () => {
		for (const status of paymentStatus.enumValues) {
			expect(canTransition('refunded', status)).toBe(false);
			expect(canTransition(status, 'pending')).toBe(false);
		}
	});
});
