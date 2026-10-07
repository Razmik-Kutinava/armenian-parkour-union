const BASE = 'http://internal.invalid';

/** Only a same-site path may be a redirect target (docs/06 section 4.11: no open redirect). */
export function safeReturnTo(value: string | null, fallback: string): string {
	if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\s]/.test(value)) {
		return fallback;
	}
	try {
		const url = new URL(value, BASE);
		if (url.origin !== BASE) return fallback;
		const path = url.pathname + url.search + url.hash;
		return /%0[ad]/i.test(path) ? fallback : path;
	} catch {
		return fallback;
	}
}
