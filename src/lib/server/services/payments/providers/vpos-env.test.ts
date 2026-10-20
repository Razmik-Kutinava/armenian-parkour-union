import { describe, expect, it } from 'vitest';
import { createRegistry } from './registry';
import { vposFromEnv } from './vpos-env';

/* docs/07 section 14 p. 1, 4: keys only from the environment; a live provider never in development. */

const fetch = globalThis.fetch;
const keys = { token: 'test-token', webhookSecret: 'whsec' };

describe('VPOS.am from the environment (docs/07 section 14)', () => {
	it('without a token or a webhook secret there is no provider', () => {
		for (const env of [
			{},
			{ token: 'test-token' },
			{ webhookSecret: 'whsec' },
			{ ...keys, token: '' }
		]) {
			expect(vposFromEnv(env, { dev: false, fetch })).toBeNull();
		}
	});

	it('a test (sandbox) token works everywhere', () => {
		for (const livemode of [undefined, '', 'false']) {
			expect(vposFromEnv({ ...keys, livemode }, { dev: true, fetch })?.id).toBe('vpos');
			expect(vposFromEnv({ ...keys, livemode }, { dev: false, fetch })?.id).toBe('vpos');
		}
	});

	it('the live mode is not allowed in development', () => {
		expect(vposFromEnv({ ...keys, livemode: 'true' }, { dev: true, fetch })).toBeNull();
		expect(vposFromEnv({ ...keys, livemode: 'true' }, { dev: false, fetch })?.id).toBe('vpos');
	});

	it('in the registry it is found by id and can take new online payments', () => {
		const vpos = vposFromEnv(keys, { dev: false, fetch })!;
		const registry = createRegistry([{ provider: vpos }]);
		expect(registry.get('vpos', { dev: false })).toBe(vpos);
		expect(registry.online({ configured: 'vpos', dev: false, enabled: true })).toBe(vpos);
	});
});
