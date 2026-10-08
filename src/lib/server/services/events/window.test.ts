import { describe, expect, it } from 'vitest';
import { registrationWindow } from './window';

/* docs/03 section 7.2: the event has not started and now is inside the window, if it is set. */
const now = new Date('2026-10-08T10:00:00Z');
const hours = (h: number) => new Date(now.getTime() + h * 3_600_000);
const event = (extra: Partial<Parameters<typeof registrationWindow>[0]> = {}) => ({
	startsAt: hours(48),
	registrationOpensAt: null,
	registrationClosesAt: null,
	...extra
});

describe('events: registration window (indicator until stage 5)', () => {
	it('open when no window is set and the event is ahead', () => {
		expect(registrationWindow(event(), now)).toEqual({ state: 'open' });
	});

	it('not open yet before the opening time, with that time', () => {
		expect(registrationWindow(event({ registrationOpensAt: hours(2) }), now)).toEqual({
			state: 'not_open',
			opensAt: hours(2)
		});
	});

	it('closed after the closing time or once the event has started', () => {
		expect(registrationWindow(event({ registrationClosesAt: hours(-1) }), now)).toEqual({
			state: 'closed'
		});
		expect(registrationWindow(event({ startsAt: hours(-1) }), now)).toEqual({ state: 'closed' });
		expect(registrationWindow(event({ startsAt: now }), now)).toEqual({ state: 'closed' });
	});

	it('open inside the window', () => {
		const inside = event({ registrationOpensAt: hours(-2), registrationClosesAt: hours(2) });
		expect(registrationWindow(inside, now)).toEqual({ state: 'open' });
	});
});
