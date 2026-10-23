import { describe, expect, it } from 'vitest';
import { MAX_CHECKS, keepChecking, paymentOutcome } from './payment-result';

/* docs/07 section 3 p. 7: the return page tells what happened and where to go next. */

const home = { path: '/', label: 'payment.toHome' };
const retry = (path: string) => ({ path, label: 'payment.retry' });

describe('payment return page: message and link by status', () => {
	it('paid: received; membership leads to the cabinet, a donation thanks and leads home', () => {
		expect(paymentOutcome({ kind: 'membership', status: 'paid' }, 'success', false)).toEqual({
			title: 'payment.paid.title',
			text: 'payment.paid.membership',
			link: { path: '/cabinet/membership', label: 'payment.toMembership' }
		});
		expect(paymentOutcome({ kind: 'donation', status: 'paid' }, 'cancel', false)).toEqual({
			title: 'payment.paid.title',
			text: 'payment.paid.donation',
			link: home
		});
		expect(paymentOutcome({ kind: 'event_fee', status: 'paid' }, 'success', true).text).toBe(
			'payment.paid.event_fee'
		);
	});

	it('pending on the success page: checking without a link, then processing', () => {
		const pending = { kind: 'donation', status: 'pending' } as const;
		expect(paymentOutcome(pending, 'success', false)).toEqual({
			title: 'payment.checking.title',
			text: 'payment.checking.text',
			link: null
		});
		expect(paymentOutcome(pending, 'success', true)).toEqual({
			title: 'payment.processing.title',
			text: 'payment.processing.text',
			link: home
		});
		expect(paymentOutcome({ kind: 'membership', status: 'pending' }, 'success', true).link).toEqual(
			{ path: '/cabinet/membership', label: 'payment.toMembership' }
		);
	});

	it('pending on the cancel page: not completed, try again on the page of the scenario', () => {
		expect(paymentOutcome({ kind: 'donation', status: 'pending' }, 'cancel', false)).toEqual({
			title: 'payment.notCompleted.title',
			text: 'payment.notCompleted.text',
			link: retry('/donate')
		});
		expect(paymentOutcome({ kind: 'membership', status: 'pending' }, 'cancel', false).link).toEqual(
			retry('/cabinet/membership')
		);
		expect(paymentOutcome({ kind: 'event_fee', status: 'pending' }, 'cancel', false).link).toEqual(
			retry('/events')
		);
	});

	it('an event fee is tried again on the page of its event', () => {
		const payment = { kind: 'event_fee', status: 'failed', eventSlug: 'spring-jam' } as const;
		expect(paymentOutcome(payment, 'success', false).link).toEqual(retry('/events/spring-jam'));
		expect(
			paymentOutcome({ ...payment, status: 'pending' }, 'cancel', false).link
		).toEqual(retry('/events/spring-jam'));
	});

	it('failed and cancelled: try again; refunded: home', () => {
		expect(paymentOutcome({ kind: 'membership', status: 'failed' }, 'success', false)).toEqual({
			title: 'payment.failed.title',
			text: 'payment.failed.text',
			link: retry('/cabinet/membership')
		});
		expect(paymentOutcome({ kind: 'donation', status: 'cancelled' }, 'cancel', false)).toEqual({
			title: 'payment.cancelled.title',
			text: 'payment.cancelled.text',
			link: retry('/donate')
		});
		expect(paymentOutcome({ kind: 'donation', status: 'refunded' }, 'success', false)).toEqual({
			title: 'payment.refunded.title',
			text: 'payment.refunded.text',
			link: home
		});
	});
});

describe('payment return page: polling', () => {
	it('only a pending payment on the success page, a limited number of times', () => {
		const pending = { kind: 'donation', status: 'pending' } as const;
		expect(keepChecking(pending, 'success', 0)).toBe(true);
		expect(keepChecking(pending, 'success', MAX_CHECKS - 1)).toBe(true);
		expect(keepChecking(pending, 'success', MAX_CHECKS)).toBe(false);
		expect(keepChecking(pending, 'cancel', 0)).toBe(false);
		expect(keepChecking({ kind: 'donation', status: 'paid' }, 'success', 0)).toBe(false);
	});
});
