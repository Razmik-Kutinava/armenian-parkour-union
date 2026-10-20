import { eq } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { users } from '../../db/schema/users';
import { startMembershipPayment } from '../memberships/start';
import { mailbox, startDeps, verifiedUser } from '../memberships/test-support';
import { allEffects } from './admin/test-support';
import type { PaymentEffects } from './effects';
import type { MockProvider } from './providers/mock';
import type { OnlineProvider, PaymentProvider, WebhookRequest } from './providers/types';
import { paymentRow } from './test-support';
import { receiveWebhook } from './webhook';
import { testIp, toRequest } from './webhook-support';

/* Test support only: docs/07 section 15 chains through the public entry points with the
 * production set of effects (fee, donation, refund letter); letters land in a mailbox. */

export function productionEffects() {
	const { sent, send } = mailbox();
	return { sent, effects: allEffects(send) };
}

/** A verified member pressed "Pay" on `/join`: pending membership and payment at the provider. */
export async function feeStarted(tx: LimitDb, provider: OnlineProvider) {
	const user = await verifiedUser(tx);
	const started = await startMembershipPayment(tx, user.id, 'en', startDeps(provider));
	if (!started.ok) throw new Error(started.reason);
	return { user, payment: await paymentRow(tx, started.paymentId) };
}

/** The provider calls `POST /api/webhooks/mock` with this notice. */
export function deliver(
	tx: LimitDb,
	mock: MockProvider,
	notice: WebhookRequest,
	effects: PaymentEffects
) {
	return receiveWebhook(tx, mock, toRequest(notice), { ip: testIp(), effects });
}

export const onlyProvider =
	(provider: PaymentProvider) =>
	(id: string): PaymentProvider | null =>
		id === provider.id ? provider : null;

export async function userRow(tx: LimitDb, id: string) {
	const [row] = await tx.select().from(users).where(eq(users.id, id));
	return row;
}
