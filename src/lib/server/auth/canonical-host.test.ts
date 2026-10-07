import { describe, expect, it } from 'vitest';
import { canonicalHostRedirect } from './canonical-host';

describe('canonicalHostRedirect', () => {
	it('sends www to the bare domain, keeping path and query', () => {
		expect(canonicalHostRedirect(new URL('https://www.parkour.am/hy/events?page=2'))).toBe(
			'https://parkour.am/hy/events?page=2'
		);
	});

	it('leaves the bare domain and other hosts alone', () => {
		expect(canonicalHostRedirect(new URL('https://parkour.am/'))).toBeNull();
		expect(canonicalHostRedirect(new URL('http://localhost:5173/login'))).toBeNull();
		expect(canonicalHostRedirect(new URL('https://armenian-parkour-union.fly.dev/'))).toBeNull();
	});
});
