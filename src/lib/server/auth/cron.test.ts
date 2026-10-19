import { describe, expect, it } from 'vitest';
import { cronAccess } from './cron';

/* Internal scheduled calls (docs/07 section 7 p. 2): only a caller with `CRON_SECRET`. */

const SECRET = 'c'.repeat(16) + 'r'.repeat(16) + 'on';

describe('cron access', () => {
	it('no secret configured, or a short one: the endpoint does not exist (404)', () => {
		for (const secret of [undefined, '', 'short-secret']) {
			expect(cronAccess(`Bearer ${secret}`, secret)).toBe(404);
		}
	});

	it('missing or wrong token: 401', () => {
		for (const header of [null, '', 'Bearer', `Bearer ${SECRET}x`, `Basic ${SECRET}`, SECRET]) {
			expect(cronAccess(header, SECRET)).toBe(401);
		}
	});

	it('the right bearer token: 200', () => {
		expect(cronAccess(`Bearer ${SECRET}`, SECRET)).toBe(200);
	});
});
