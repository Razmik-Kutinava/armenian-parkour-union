import { describe, expect, it } from 'vitest';
import { withSecurityHeaders } from './security-headers';

const expected = {
	'strict-transport-security': 'max-age=31536000',
	'x-content-type-options': 'nosniff',
	'x-frame-options': 'DENY',
	'referrer-policy': 'strict-origin-when-cross-origin',
	'cross-origin-opener-policy': 'same-origin'
};

describe('security headers (roadmap 8.6)', () => {
	it('every response gets HSTS, nosniff, no framing, a referrer policy and COOP', async () => {
		const response = withSecurityHeaders(new Response('<p>hi</p>', { status: 201 }));
		for (const [name, value] of Object.entries(expected)) {
			expect(response.headers.get(name), name).toBe(value);
		}
		expect(response.status).toBe(201);
		expect(await response.text()).toBe('<p>hi</p>');
	});

	it('camera, microphone, geolocation, payment, USB and topics are off', () => {
		const policy = withSecurityHeaders(new Response()).headers.get('permissions-policy') ?? '';
		for (const feature of ['camera', 'microphone', 'geolocation', 'payment', 'usb']) {
			expect(policy, feature).toContain(`${feature}=()`);
		}
		expect(policy).toContain('browsing-topics=()');
	});

	it('a header the route set itself stays', () => {
		const own = new Response(null, { headers: { 'referrer-policy': 'no-referrer' } });
		expect(withSecurityHeaders(own).headers.get('referrer-policy')).toBe('no-referrer');
	});

	it('a redirect with immutable headers keeps its status and location', () => {
		const response = withSecurityHeaders(Response.redirect('https://checkout.vpos.am/s/a', 303));
		expect(response.status).toBe(303);
		expect(response.headers.get('location')).toBe('https://checkout.vpos.am/s/a');
		expect(response.headers.get('x-content-type-options')).toBe('nosniff');
	});
});
