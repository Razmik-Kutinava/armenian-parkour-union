import { eq } from 'drizzle-orm';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { shopOrders } from '../../db/schema/shop';
import { users } from '../../db/schema/users';
import type { Mail } from '../../mail/resend';
import { writeAudit } from '../audit';
import { isUuid, type Actor } from '../users/target';
import type { OrderStatus } from './order-list';
import { orderStatusLetter } from './order-mail';

/* docs/05 section 15, docs/04 sections 3.2 and 7 item 6; decisions — docs/todo.md 7.4 (1–4).
 * A status only moves forward; `cancelled` is never set here — the cancel with a refund is
 * order-cancel.ts. */

export type OrderDeps = {
	send: (mail: Mail) => Promise<void>;
	siteUrl: string | undefined;
	ip: string | null;
};
type Outcome = 'ok' | 'bad_status' | 'not_found' | 'not_allowed';

const FLOW: OrderStatus[] = ['new', 'confirmed', 'shipped', 'delivered'];
const TARGETS: readonly string[] = FLOW.slice(1);

export async function lockOrder(tx: LimitDb, id: string) {
	const [row] = await tx
		.select({
			order: shopOrders,
			user: {
				email: users.email,
				locale: users.locale,
				firstName: users.firstName,
				name: users.name,
				deletedAt: users.deletedAt
			}
		})
		.from(shopOrders)
		.innerJoin(users, eq(users.id, shopOrders.userId))
		.where(eq(shopOrders.id, id))
		.for('update', { of: shopOrders });
	return row;
}

/** Forward along new → confirmed → shipped → delivered (a step may be skipped); a letter after commit. */
export async function changeOrderStatus(
	db: LimitDb,
	actor: Actor,
	id: string,
	status: string,
	deps: OrderDeps
): Promise<Outcome> {
	if (!roleCan(actor.role, 'shop.orders_manage')) return 'not_allowed';
	if (!isUuid(id)) return 'not_found';
	if (!TARGETS.includes(status)) return 'bad_status';
	const target = status as OrderStatus;
	const outcome = await db.transaction(async (tx) => {
		const row = await lockOrder(tx, id);
		if (!row) return 'not_found' as const;
		const { order, user } = row;
		const from = FLOW.indexOf(order.status);
		if (from < 0 || FLOW.indexOf(target) <= from) return 'bad_status' as const;
		await tx.update(shopOrders).set({ status: target }).where(eq(shopOrders.id, id));
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'shop_order.status',
			entityType: 'shop_order',
			entityId: id,
			before: { status: order.status },
			after: { status: target, number: order.number },
			ip: deps.ip
		});
		if (user.deletedAt) return null;
		return orderStatusLetter(user, { ...order, status: target }, deps.siteUrl);
	});
	if (typeof outcome === 'string') return outcome;
	if (outcome) {
		await deps.send(outcome).catch((e) => console.warn(`order ${id}: letter not sent`, e));
	}
	return 'ok';
}

/** The shipping note, without a letter; a cancelled order keeps its note. */
export async function setTrackingNote(
	db: LimitDb,
	actor: Actor,
	id: string,
	note: string | null,
	ip: string | null
): Promise<Outcome> {
	if (!roleCan(actor.role, 'shop.orders_manage')) return 'not_allowed';
	if (!isUuid(id)) return 'not_found';
	return db.transaction(async (tx) => {
		const row = await lockOrder(tx, id);
		if (!row) return 'not_found' as const;
		const { order } = row;
		if (order.status === 'cancelled') return 'bad_status' as const;
		if (order.trackingNote === note) return 'ok' as const;
		await tx.update(shopOrders).set({ trackingNote: note }).where(eq(shopOrders.id, id));
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'shop_order.tracking',
			entityType: 'shop_order',
			entityId: id,
			before: { trackingNote: order.trackingNote },
			after: { trackingNote: note },
			ip
		});
		return 'ok' as const;
	});
}
