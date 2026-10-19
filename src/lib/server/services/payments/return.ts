import { eq } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { payments } from '../../db/schema/payments';
import { isUuid } from '../users/target';
import { applyProviderStatus } from './apply';
import { paymentEffects, type PaymentEffects } from './effects';
import type { PaymentProvider } from './providers/types';

export type ReturnDeps = {
	/** Provider of an existing payment; `null` — not available here, nothing is asked. */
	providerOf: (id: string) => PaymentProvider | null;
	/** Counted only when the provider would be asked; `false` — the status from the database. */
	allowCheck: () => Promise<boolean>;
	effects?: PaymentEffects;
};

/** What the page may show: no payer, no links to other records. */
export type ReturnView = Pick<
	typeof payments.$inferSelect,
	'kind' | 'status' | 'amountMinor' | 'currency'
>;

async function read(db: LimitDb, id: string) {
	const [row] = await db
		.select({
			kind: payments.kind,
			status: payments.status,
			amountMinor: payments.amountMinor,
			currency: payments.currency,
			provider: payments.provider,
			providerPaymentId: payments.providerPaymentId
		})
		.from(payments)
		.where(eq(payments.id, id));
	return row ?? null;
}

const view = ({ kind, status, amountMinor, currency }: ReturnView): ReturnView => ({
	kind,
	status,
	amountMinor,
	currency
});

/**
 * docs/07 sections 1 p. 3, 7 p. 1: the return proves nothing. A pending payment is asked about at
 * the provider and the answer goes the webhook way; any trouble there leaves our status as is.
 */
export async function paymentForReturn(
	db: LimitDb,
	pid: string,
	{ providerOf, allowCheck, effects = paymentEffects }: ReturnDeps
): Promise<ReturnView | null> {
	if (!isUuid(pid)) return null;
	const row = await read(db, pid);
	if (!row) return null;
	const provider = row.status === 'pending' ? providerOf(row.provider) : null;
	if (!provider?.online || !row.providerPaymentId || !(await allowCheck())) return view(row);
	try {
		const state = await provider.getStatus(row.providerPaymentId);
		const report = { provider: provider.id, providerPaymentId: row.providerPaymentId, ...state };
		if ((await applyProviderStatus(db, report, effects)) === 'unchanged') return view(row);
	} catch (e) {
		console.warn(`payment ${pid}: status check on return failed`, e);
		return view(row);
	}
	const fresh = await read(db, pid);
	return fresh ? view(fresh) : null;
}
