import { describe, expect, it } from 'vitest';
import { manualProvider } from './manual';
import { createMockProvider } from './mock';
import { createRegistry, onlinePaymentsEnabled, paymentProviders } from './registry';
import { PaymentConfigError } from './types';

/* docs/07 section 4: one registry; env variable + feature_flags; mock only in development. */

const mock = createMockProvider();
const registry = createRegistry([{ provider: manualProvider }, { provider: mock, devOnly: true }]);
const dev = { dev: true };
const prod = { dev: false };

describe('payment provider registry (docs/07 section 4)', () => {
	it('manual is always there, offline, in AMD, USD and EUR', () => {
		expect(registry.get('manual', dev)).toBe(manualProvider);
		expect(registry.get('manual', prod)).toBe(manualProvider);
		expect(manualProvider.online).toBe(false);
		expect([...manualProvider.currencies].sort()).toEqual(['AMD', 'EUR', 'USD']);
	});

	it('mock is found only in development', () => {
		expect(registry.get('mock', dev)).toBe(mock);
		expect(registry.get('mock', prod)).toBeNull();
	});

	it('the app registry hides mock outside development too', () => {
		expect(paymentProviders.get('mock', prod)).toBeNull();
		expect(paymentProviders.get('mock', dev)?.id).toBe('mock');
		expect(paymentProviders.get('manual', prod)).toBe(manualProvider);
	});

	it('an unknown provider is not found', () => {
		expect(registry.get('ameriabank', dev)).toBeNull();
		expect(registry.get('', prod)).toBeNull();
		expect(registry.get('__proto__', prod)).toBeNull();
	});

	it('without PAYMENT_PROVIDER there is no online payment', () => {
		for (const configured of [undefined, '']) {
			expect(registry.online({ configured, ...dev, enabled: true })).toBeNull();
		}
	});

	it('PAYMENT_PROVIDER=mock in development gives mock, if the flag allows', () => {
		expect(registry.online({ configured: 'mock', ...dev, enabled: true })).toBe(mock);
		expect(registry.online({ configured: 'mock', ...dev, enabled: false })).toBeNull();
	});

	it('mock outside development, an unknown name or manual as online is a config error', () => {
		const wrong = [
			{ configured: 'mock', ...prod },
			{ configured: 'ameriabank', ...dev },
			{ configured: 'manual', ...dev }
		];
		for (const config of wrong) {
			expect(() => registry.online({ ...config, enabled: true })).toThrow(PaymentConfigError);
			expect(() => registry.online({ ...config, enabled: false })).toThrow(PaymentConfigError);
		}
	});

	it('feature_flags.payments_online switches online payment off only when it is false', () => {
		expect(onlinePaymentsEnabled({ payments_online: false })).toBe(false);
		for (const flags of [undefined, null, {}, { payments_online: true }, 'broken', []]) {
			expect(onlinePaymentsEnabled(flags)).toBe(true);
		}
	});
});
