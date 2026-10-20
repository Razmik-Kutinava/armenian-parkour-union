import { eq } from 'drizzle-orm';
import { roleCan } from '../../../auth/permissions';
import type { LimitDb } from '../../../auth/rate-limit';
import { payments } from '../../../db/schema/payments';
import { isUuid, type Actor } from '../../users/target';
import type { PaymentRow } from '../effects';

export type AdminPaymentResult =
	| 'ok'
	| 'not_found'
	| 'not_allowed'
	| 'invalid'
	| 'wrong_status'
	| 'unsupported'
	| 'provider_error'
	| 'no_recipient'
	| 'mail_failed';

/** docs/04 section 5 p. 6: the service checks the right itself, wherever the call comes from. */
export const canManage = (actor: Actor) => roleCan(actor.role, 'payments.manage');

/** The payment locked for the change: a webhook or another admin waits for it. */
export async function lockPayment(tx: LimitDb, id: string): Promise<PaymentRow | null> {
	if (!isUuid(id)) return null;
	const [row] = await tx.select().from(payments).where(eq(payments.id, id)).for('update');
	return row ?? null;
}
