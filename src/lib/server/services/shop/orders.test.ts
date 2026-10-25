import { and, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { translate } from '#lib/i18n/translate.ts';
import type { LimitDb } from '../../auth/rate-limit';
import type { UserRole } from '../../auth/session';
import { auditLog } from '../../db/schema/service';
import { shopItems, shopOrderItems, shopOrders } from '../../db/schema/shop';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import type { Mail } from '../../mail/resend';
import { getOrder, listOrders } from './order-list';
import { changeOrderStatus, setTrackingNote } from './orders';

/* docs/05 section 15, docs/04 section 3.2, docs/03 sections 9 and 14; decisions — docs/todo.md
 * 7.4 (1–4, 9). Cancelling with a refund is 7.6. */

const SITE = 'https://parkour.test';
const IP = '10.0.0.8';
const LIST = { page: 1, sort: 'createdAt', dir: 'desc' as const, q: '', filters: {} };

function deps() {
	const sent: Mail[] = [];
	return { sent, send: async (mail: Mail) => void sent.push(mail), siteUrl: SITE, ip: IP };
}

async function staff(tx: LimitDb, role: UserRole = 'moderator') {
	const { id } = await insertUser(tx, { role });
	return { id, role };
}

async function item(tx: LimitDb, title: string) {
	const [row] = await tx
		.insert(shopItems)
		.values({ slug: `t-${crypto.randomUUID()}`, title: { en: title }, pricePoints: 40 })
		.returning();
	return row;
}

let n = 0;
async function order(
	tx: LimitDb,
	userId: string,
	values: Partial<typeof shopOrders.$inferInsert> = {}
) {
	n += 1;
	const [row] = await tx
		.insert(shopOrders)
		.values({
			number: `ORD-2026-T${crypto.randomUUID().slice(0, 6)}${n}`,
			userId,
			totalPoints: 120,
			recipientName: 'Ani Petrosyan',
			phone: '+37491000000',
			city: 'Gyumri',
			address: 'Rizhkov 5',
			comment: 'Call first',
			...values
		})
		.returning();
	const cap = await item(tx, 'Cap');
	const tee = await item(tx, 'Tee');
	await tx.insert(shopOrderItems).values([
		{ orderId: row.id, itemId: cap.id, quantity: 1, pricePointsSnapshot: 40 },
		{
			orderId: row.id,
			itemId: tee.id,
			quantity: 2,
			pricePointsSnapshot: 40,
			selectedOptions: { Size: 'M' }
		}
	]);
	return row;
}

const statusOf = async (tx: LimitDb, id: string) =>
	(await tx.select().from(shopOrders).where(eq(shopOrders.id, id)))[0];
const auditOf = (tx: LimitDb, id: string) =>
	tx
		.select()
		.from(auditLog)
		.where(and(eq(auditLog.entityType, 'shop_order'), eq(auditLog.entityId, id)));

describe.skipIf(!testDbUrl)('shop: orders in the admin', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('a moderator confirms: status, audit, a letter in the member language', async () => {
		await inRollback(async (tx) => {
			const member = await insertUser(tx, { locale: 'ru' });
			const moderator = await staff(tx);
			const o = await order(tx, member.id);
			const d = deps();
			expect(await changeOrderStatus(tx, moderator, o.id, 'confirmed', d)).toBe('ok');
			expect((await statusOf(tx, o.id)).status).toBe('confirmed');
			const [entry] = await auditOf(tx, o.id);
			expect(entry).toMatchObject({ action: 'shop_order.status', actorId: moderator.id, ip: IP });
			expect(entry.before).toEqual({ status: 'new' });
			expect(entry.after).toEqual({ status: 'confirmed', number: o.number });
			expect(d.sent).toHaveLength(1);
			expect(d.sent[0].to).toBe(member.email);
			expect(d.sent[0].subject).toBe(
				translate('ru', 'shop.mail.subject', {
					number: o.number,
					status: translate('ru', 'shop.order.status.confirmed')
				})
			);
			expect(d.sent[0].text).toContain(o.number);
			expect(d.sent[0].text).toContain(`${SITE}/ru/cabinet/orders`);
		});
	});

	it('only forward; a step may be skipped; delivered is final', async () => {
		await inRollback(async (tx) => {
			const member = await insertUser(tx);
			const admin = await staff(tx, 'admin');
			const o = await order(tx, member.id);
			const d = deps();
			expect(await changeOrderStatus(tx, admin, o.id, 'shipped', d)).toBe('ok');
			expect(await changeOrderStatus(tx, admin, o.id, 'confirmed', d)).toBe('bad_status');
			expect(await changeOrderStatus(tx, admin, o.id, 'shipped', d)).toBe('bad_status');
			expect(await changeOrderStatus(tx, admin, o.id, 'new', d)).toBe('bad_status');
			expect(await changeOrderStatus(tx, admin, o.id, 'delivered', d)).toBe('ok');
			expect(await changeOrderStatus(tx, admin, o.id, 'delivered', d)).toBe('bad_status');
			expect((await statusOf(tx, o.id)).status).toBe('delivered');
			expect(d.sent).toHaveLength(2);
			expect((await auditOf(tx, o.id)).map((e) => e.action)).toEqual([
				'shop_order.status',
				'shop_order.status'
			]);
		});
	});

	it('cancelled is not set by a status change, by a moderator or an admin', async () => {
		await inRollback(async (tx) => {
			const member = await insertUser(tx);
			const o = await order(tx, member.id);
			for (const role of ['moderator', 'admin'] as const) {
				const actor = await staff(tx, role);
				const d = deps();
				expect(await changeOrderStatus(tx, actor, o.id, 'cancelled', d)).toBe('bad_status');
				expect(await changeOrderStatus(tx, actor, o.id, 'paid', d)).toBe('bad_status');
				expect(d.sent).toHaveLength(0);
			}
			expect((await statusOf(tx, o.id)).status).toBe('new');
			expect(await auditOf(tx, o.id)).toHaveLength(0);
		});
	});

	it('a cancelled order does not move and keeps its note', async () => {
		await inRollback(async (tx) => {
			const member = await insertUser(tx);
			const admin = await staff(tx, 'admin');
			const o = await order(tx, member.id, { status: 'cancelled', trackingNote: 'Old' });
			expect(await changeOrderStatus(tx, admin, o.id, 'confirmed', deps())).toBe('bad_status');
			expect(await setTrackingNote(tx, admin, o.id, 'New', IP)).toBe('bad_status');
			expect(await statusOf(tx, o.id)).toMatchObject({ status: 'cancelled', trackingNote: 'Old' });
		});
	});

	it('an editor or a member may not manage orders; nothing changes', async () => {
		await inRollback(async (tx) => {
			const member = await insertUser(tx);
			const o = await order(tx, member.id);
			for (const role of ['editor', 'member'] as const) {
				const actor = await staff(tx, role);
				expect(await changeOrderStatus(tx, actor, o.id, 'confirmed', deps())).toBe('not_allowed');
				expect(await setTrackingNote(tx, actor, o.id, 'RR1', IP)).toBe('not_allowed');
			}
			expect(await statusOf(tx, o.id)).toMatchObject({ status: 'new', trackingNote: null });
		});
	});

	it('an unknown or malformed order is not found', async () => {
		await inRollback(async (tx) => {
			const moderator = await staff(tx);
			for (const id of [crypto.randomUUID(), 'nope']) {
				expect(await changeOrderStatus(tx, moderator, id, 'confirmed', deps())).toBe('not_found');
				expect(await setTrackingNote(tx, moderator, id, 'RR1', IP)).toBe('not_found');
				expect(await getOrder(tx, id)).toBeNull();
			}
		});
	});

	it('the shipping note: saved, cleared, logged, no letter; the shipped letter carries it', async () => {
		await inRollback(async (tx) => {
			const member = await insertUser(tx);
			const moderator = await staff(tx);
			const o = await order(tx, member.id);
			expect(await setTrackingNote(tx, moderator, o.id, 'RR123456789AM', IP)).toBe('ok');
			expect(await setTrackingNote(tx, moderator, o.id, 'RR123456789AM', IP)).toBe('ok');
			expect((await statusOf(tx, o.id)).trackingNote).toBe('RR123456789AM');
			const d = deps();
			expect(await changeOrderStatus(tx, moderator, o.id, 'shipped', d)).toBe('ok');
			expect(d.sent[0].text).toContain('RR123456789AM');
			expect(await setTrackingNote(tx, moderator, o.id, null, IP)).toBe('ok');
			expect((await statusOf(tx, o.id)).trackingNote).toBeNull();
			const notes = (await auditOf(tx, o.id)).filter((e) => e.action === 'shop_order.tracking');
			expect(notes.map((e) => [e.before, e.after])).toEqual([
				[{ trackingNote: null }, { trackingNote: 'RR123456789AM' }],
				[{ trackingNote: 'RR123456789AM' }, { trackingNote: null }]
			]);
			expect(d.sent).toHaveLength(1);
		});
	});

	it('a deleted account gets no letter; a failed letter does not undo the change', async () => {
		await inRollback(async (tx) => {
			const moderator = await staff(tx);
			const gone = await insertUser(tx, { deletedAt: new Date() });
			const first = await order(tx, gone.id);
			const d = deps();
			expect(await changeOrderStatus(tx, moderator, first.id, 'confirmed', d)).toBe('ok');
			expect(d.sent).toHaveLength(0);

			const member = await insertUser(tx);
			const second = await order(tx, member.id);
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const failing = {
				...deps(),
				send: async () => {
					throw new Error('mail is down');
				}
			};
			expect(await changeOrderStatus(tx, moderator, second.id, 'confirmed', failing)).toBe('ok');
			expect(warn).toHaveBeenCalled();
			warn.mockRestore();
			expect((await statusOf(tx, second.id)).status).toBe('confirmed');
		});
	});

	it('the card: lines with options and price snapshots, delivery data, the comment', async () => {
		await inRollback(async (tx) => {
			const member = await insertUser(tx);
			const o = await order(tx, member.id);
			const card = await getOrder(tx, o.id);
			expect(card).toMatchObject({
				id: o.id,
				number: o.number,
				status: 'new',
				userId: member.id,
				totalPoints: 120,
				recipientName: 'Ani Petrosyan',
				phone: '+37491000000',
				city: 'Gyumri',
				address: 'Rizhkov 5',
				comment: 'Call first',
				trackingNote: null
			});
			expect(card?.memberName).toContain('Test');
			expect(card?.lines).toHaveLength(2);
			expect(card?.lines).toEqual(expect.arrayContaining([
				expect.objectContaining({
					title: { en: 'Cap' },
					quantity: 1,
					pricePointsSnapshot: 40,
					selectedOptions: null
				}),
				expect.objectContaining({
					title: { en: 'Tee' },
					quantity: 2,
					pricePointsSnapshot: 40,
					selectedOptions: { Size: 'M' }
				})
			]));
		});
	});

	it('the list: newest first, filters by status and period, search by number or name', async () => {
		await inRollback(async (tx) => {
			const member = await insertUser(tx);
			const older = await order(tx, member.id, {
				createdAt: new Date('2026-09-10T10:00:00+04:00')
			});
			const newer = await order(tx, member.id, {
				status: 'shipped',
				createdAt: new Date('2026-10-20T10:00:00+04:00')
			});
			const ids = async (q: string, filters: Record<string, string> = {}) =>
				(await listOrders(tx, { ...LIST, q, filters })).rows.map((r) => r.id);
			expect(await ids(member.lastName)).toEqual([newer.id, older.id]);
			expect(await ids(member.lastName, { status: 'shipped' })).toEqual([newer.id]);
			expect(await ids(member.lastName, { status: 'bogus' })).toEqual([newer.id, older.id]);
			expect(await ids(member.lastName, { from: '2026-10-01' })).toEqual([newer.id]);
			expect(await ids(member.lastName, { to: '2026-09-10' })).toEqual([older.id]);
			expect(await ids(older.number)).toEqual([older.id]);
			const { rows, total } = await listOrders(tx, { ...LIST, q: member.lastName, filters: {} });
			expect(total).toBe(2);
			expect(rows[0]).toMatchObject({
				number: newer.number,
				userId: member.id,
				totalPoints: 120,
				status: 'shipped'
			});
			const lines = rows[0].lines.map((l) => [l.title, l.quantity]);
			expect(lines.sort((a, b) => Number(a[1]) - Number(b[1]))).toEqual([
				[{ en: 'Cap' }, 1],
				[{ en: 'Tee' }, 2]
			]);
		});
	});
});
