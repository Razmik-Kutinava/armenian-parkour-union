import { inArray } from 'drizzle-orm';
import { shopItems, shopOrders } from '../../db/schema/shop';
import { appendEntry } from '../points/ledger';
import { raceDb } from '../registrations/race-support';
import { addItem } from './test-support';

/* Test support only: simultaneous orders and cancels commit (registrations/race-support.ts).
 * Afterwards the orders of these buyers (lines cascade) and the items are deleted — the admin list
 * of orders does not hide deleted accounts; ledger and audit entries stay (append-only). */

export function shopRaceDb() {
	const db = raceDb();
	const buyers: string[] = [];
	const items: string[] = [];

	/** An active member with `points` on the balance, written through the ledger like any other. */
	async function buyer(points = 150) {
		const { id } = await db.member();
		buyers.push(id);
		const given = await appendEntry(db.main, {
			userId: id,
			delta: points,
			reason: 'manual',
			comment: 'Race test balance',
			createdBy: null
		});
		if (given.status !== 'ok') throw new Error(`balance for ${id}: ${given.status}`);
		return id;
	}

	async function item(values: Parameters<typeof addItem>[1] = {}) {
		const row = await addItem(db.main, values);
		items.push(row.id);
		return row;
	}

	async function cleanup() {
		if (buyers.length) await db.main.delete(shopOrders).where(inArray(shopOrders.userId, buyers));
		if (items.length) await db.main.delete(shopItems).where(inArray(shopItems.id, items));
		await db.cleanup();
	}

	return { ...db, buyer, item, cleanup };
}
