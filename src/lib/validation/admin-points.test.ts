import { describe, expect, it } from 'vitest';
import { pointsReason } from '#lib/server/db/schema/enums.ts';
import { adjustSchema, memberQuerySchema, POINTS_REASONS, reverseSchema } from './admin-points';

/* docs/05 section 12, docs/03 section 6.3: admin forms of the points ledger, checked on the server. */

const userId = crypto.randomUUID();
const errorOf = (input: Record<string, string>) => {
	const result = adjustSchema.safeParse(input);
	return result.success
		? null
		: Object.fromEntries(result.error.issues.map((i) => [i.path[0], i.message]));
};

describe('points admin forms', () => {
	it('reasons for the filter are the database enum', () => {
		expect([...POINTS_REASONS]).toEqual(pointsReason.enumValues);
	});

	it('adjustment: signed whole amount, trimmed comment', () => {
		expect(adjustSchema.parse({ userId, delta: ' +50 ', comment: ' Jam ' })).toEqual({
			userId,
			delta: 50,
			comment: 'Jam'
		});
		expect(adjustSchema.parse({ userId, delta: '-30', comment: 'Fix' }).delta).toBe(-30);
		expect(adjustSchema.parse({ userId, delta: '2147483647', comment: 'x' }).delta).toBe(
			2_147_483_647
		);
	});

	it('adjustment refusals: zero, fraction, text, out of range, no comment, no member', () => {
		for (const delta of ['0', '-0', '1.5', 'abc', '', '2147483648', '-2147483648', '1e3']) {
			expect(errorOf({ userId, delta, comment: 'x' }), delta).toEqual({
				delta: 'points.error.delta'
			});
		}
		expect(errorOf({ userId, delta: '5', comment: '   ' })).toEqual({
			comment: 'auth.error.required'
		});
		expect(errorOf({ userId, delta: '5', comment: 'x'.repeat(1001) })).toEqual({
			comment: 'auth.error.tooLong'
		});
		expect(errorOf({ userId: 'nope', delta: '5', comment: 'x' })).toEqual({
			userId: 'points.error.member'
		});
	});

	it('reversal: entry id and a comment', () => {
		const entryId = crypto.randomUUID();
		expect(reverseSchema.parse({ entryId, comment: ' Wrong ' })).toEqual({
			entryId,
			comment: 'Wrong'
		});
		expect(reverseSchema.safeParse({ entryId, comment: '' }).success).toBe(false);
		expect(reverseSchema.safeParse({ entryId: 'x', comment: 'ok' }).success).toBe(false);
	});

	it('member lookup: email lowercased', () => {
		expect(memberQuerySchema.parse({ email: ' A@B.am ' })).toEqual({ email: 'a@b.am' });
		expect(memberQuerySchema.safeParse({ email: 'nope' }).success).toBe(false);
	});
});
