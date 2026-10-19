import type { LimitDb } from '../../auth/rate-limit';
import { insertUser } from '../../db/test-db';
import { startOnlinePayment } from './create';
import type { PaymentEffects } from './effects';
import { createMockProvider } from './providers/mock';
import type { OnlineProvider, ProviderPaymentState } from './providers/types';
import type { ReconcileDeps } from './reconcile';
import { SITE, membershipPayment, paymentRow } from './test-support';

/* Test support only: a mock "bank" under its own id, so a run never touches other rows of the
 * shared database, and a clock moved forward instead of waiting. */

export function ownMock() {
	const mock = createMockProvider();
	const checked: string[] = [];
	const getStatus = mock.getStatus.bind(mock);
	const provider = {
		...mock,
		id: `mock-${crypto.randomUUID()}`,
		getStatus: async (providerPaymentId: string): Promise<ProviderPaymentState> => {
			checked.push(providerPaymentId);
			return getStatus(providerPaymentId);
		}
	};
	return { provider, checked };
}

export async function startedAt(tx: LimitDb, provider: OnlineProvider) {
	const input = membershipPayment((await insertUser(tx)).id);
	const result = await startOnlinePayment(tx, input, { provider, siteUrl: SITE });
	if (!result.ok) throw new Error(result.reason);
	const row = await paymentRow(tx, result.paymentId);
	return { id: row.id, providerPaymentId: row.providerPaymentId! };
}

/** Payments are started with a 30-minute hold (`membershipPayment`). */
export const later = (minutes: number) => new Date(Date.now() + minutes * 60_000);

export const depsFor = (
	provider: OnlineProvider,
	now: Date,
	effects: PaymentEffects = {}
): ReconcileDeps => ({
	providerOf: (id) => (id === provider.id ? provider : null),
	now,
	effects
});
