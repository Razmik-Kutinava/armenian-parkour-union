import { describe, expect, it } from 'vitest';
import type { MembershipOverview, MembershipPeriod } from '../memberships/overview';
import { REMIND_DAYS, membershipReminder } from './reminder';

/* docs/06 section 2, docs/03 section 2 p. 4: the banner reminds of an ended or ending membership. */

const NOW = new Date('2026-10-20T08:00:00Z');
const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000);
const period = (
	status: MembershipPeriod['status'],
	from: number,
	to: number
): MembershipPeriod => ({
	status,
	startsAt: day(from),
	endsAt: day(to)
});
const overview = (extra: Partial<MembershipOverview>): MembershipOverview => ({
	active: false,
	paidUntil: null,
	waiting: false,
	history: [],
	...extra
});

describe('cabinet: membership reminder', () => {
	it('reminds 30 days ahead, like the first letter', () => {
		expect(REMIND_DAYS).toBe(30);
	});

	it('never joined: no reminder', () => {
		expect(membershipReminder(overview({}), NOW)).toBeNull();
	});

	it('active with more than 30 days left: no reminder', () => {
		const o = overview({ active: true, paidUntil: day(31), history: [period('active', -334, 31)] });
		expect(membershipReminder(o, NOW)).toBeNull();
	});

	it('active and ends within 30 days: "ends soon" with the end date', () => {
		const o = overview({ active: true, paidUntil: day(30), history: [period('active', -335, 30)] });
		expect(membershipReminder(o, NOW)).toEqual({ kind: 'ends_soon', date: day(30) });
	});

	it('a renewal paid ahead counts: the latest end decides', () => {
		const o = overview({
			active: true,
			paidUntil: day(370),
			history: [period('active', 5, 370), period('active', -360, 5)]
		});
		expect(membershipReminder(o, NOW)).toBeNull();
	});

	it('the last paid period ended: "expired" with its end date', () => {
		const o = overview({ history: [period('expired', -400, -35), period('expired', -800, -400)] });
		expect(membershipReminder(o, NOW)).toEqual({ kind: 'expired', date: day(-35) });
	});

	it('an active row past its end (daily job not run yet) is expired too', () => {
		const o = overview({ history: [period('active', -366, -1)] });
		expect(membershipReminder(o, NOW)).toEqual({ kind: 'expired', date: day(-1) });
	});

	it('a refunded membership is not "expired"', () => {
		const o = overview({ history: [period('cancelled', -30, 335)] });
		expect(membershipReminder(o, NOW)).toBeNull();
	});

	it('a payment awaiting confirmation: no reminder', () => {
		const o = overview({ waiting: true, history: [period('expired', -400, -35)] });
		expect(membershipReminder(o, NOW)).toBeNull();
	});
});
