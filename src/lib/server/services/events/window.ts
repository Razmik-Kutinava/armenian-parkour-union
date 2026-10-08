/* docs/03 section 7.2: registration is possible before the start and inside the window, if set. */

export type RegistrationWindow =
	{ state: 'open' } | { state: 'not_open'; opensAt: Date } | { state: 'closed' };

type Times = {
	startsAt: Date;
	registrationOpensAt: Date | null;
	registrationClosesAt: Date | null;
};

export function registrationWindow(event: Times, now: Date = new Date()): RegistrationWindow {
	const t = now.getTime();
	if (event.startsAt.getTime() <= t) return { state: 'closed' };
	if (event.registrationClosesAt && event.registrationClosesAt.getTime() <= t) {
		return { state: 'closed' };
	}
	if (event.registrationOpensAt && event.registrationOpensAt.getTime() > t) {
		return { state: 'not_open', opensAt: event.registrationOpensAt };
	}
	return { state: 'open' };
}
