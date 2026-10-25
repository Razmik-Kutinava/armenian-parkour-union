/** Sent with every response that passes the hooks; files of `static/` and `/_app/immutable/`
 * are served by adapter-node before them. No HSTS includeSubDomains: subdomains are not all checked.
 * COOP same-origin: Google sign-in and payment leave by navigation, not a popup. */
const SECURITY_HEADERS = {
	'strict-transport-security': 'max-age=31536000',
	'x-content-type-options': 'nosniff',
	'x-frame-options': 'DENY',
	'referrer-policy': 'strict-origin-when-cross-origin',
	'cross-origin-opener-policy': 'same-origin',
	'permissions-policy':
		'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()'
};

export function withSecurityHeaders(response: Response): Response {
	const missing = Object.entries(SECURITY_HEADERS).filter(([name]) => !response.headers.has(name));
	if (missing.length === 0) return response;
	try {
		for (const [name, value] of missing) response.headers.set(name, value);
		return response;
	} catch {
		/* Response.redirect() and fetched responses have immutable headers. */
		const copy = new Response(response.body, response);
		for (const [name, value] of missing) copy.headers.set(name, value);
		return copy;
	}
}
