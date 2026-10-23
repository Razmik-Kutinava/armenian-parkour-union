import { afterAll, describe, expect, it } from 'vitest';
import { readListState } from '#lib/components/admin/list-state.ts';
import { insertUser, testDb, testDbUrl } from '../../../db/test-db';
import { createMockProvider } from '../../payments/providers/mock';
import { feeEffects, paidEvent, payStarted, settleFee } from '../pay-support';
import {
	bornBefore,
	insertCategory,
	insertEvent,
	insertMember,
	registerOk as register
} from '../test-support';
import { listRegistrations, registrationCounts, registrationListOptions } from './list';

/* docs/05 section 5, docs/04 section 4: the registrations of one event for staff; a moderator
 * sees the name and the age, never the email, the birth date or the payment. */

type Tx = Parameters<typeof insertUser>[0];
const staff = async (tx: Tx, role: 'moderator' | 'admin') => ({
	id: (await insertUser(tx, { role })).id,
	role
});
const state = (query: Record<string, string> = {}) =>
	readListState(new URLSearchParams(query), registrationListOptions);

describe.skipIf(!testDbUrl)('registrations staff: the list', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('a moderator gets name, age on the event day and category — no contacts', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx);
			const speed = await insertCategory(tx, event.id, { name: { en: 'Speed', ru: 'Скорость' } });
			const member = await insertMember(tx, { birthDate: bornBefore(20) });
			await register(tx, member.id, event.id, speed.id);
			await register(tx, (await insertMember(tx)).id, (await insertEvent(tx)).id);

			const list = await listRegistrations(tx, await staff(tx, 'moderator'), event.id, state());
			expect(list?.total).toBe(1);
			const [row] = list!.rows;
			expect(row).toMatchObject({
				userId: member.id,
				age: 20,
				categoryId: speed.id,
				categoryName: { en: 'Speed', ru: 'Скорость' },
				status: 'registered',
				paid: null
			});
			expect(row).not.toHaveProperty('email');
			expect(row).not.toHaveProperty('birthDate');
			expect(row).not.toHaveProperty('paymentId');
			expect(JSON.stringify(row)).not.toContain(member.email);
		});
	});

	it('an admin also gets the email and the payment; search by email is admin only', async () => {
		await inRollback(async (tx) => {
			const mock = createMockProvider();
			const event = await paidEvent(tx);
			const paid = await payStarted(tx, mock, event.id);
			await settleFee(tx, mock, paid.payment.id, 'paid', feeEffects());

			const admin = await staff(tx, 'admin');
			const byEmail = state({ q: paid.member.email });
			const [row] = (await listRegistrations(tx, admin, event.id, byEmail))!.rows;
			expect(row).toMatchObject({
				email: paid.member.email,
				paymentId: paid.payment.id,
				paid: true
			});
			const moderator = await staff(tx, 'moderator');
			expect((await listRegistrations(tx, moderator, event.id, byEmail))!.total).toBe(0);
		});
	});

	it('filters: status, category, paid; search by name; queue order', async () => {
		await inRollback(async (tx) => {
			const mock = createMockProvider();
			const event = await paidEvent(tx, { capacity: 2 });
			const paid = await payStarted(tx, mock, event.id);
			await settleFee(tx, mock, paid.payment.id, 'paid', feeEffects());
			const unpaid = await payStarted(tx, mock, event.id);
			const speed = await insertCategory(tx, event.id);
			const late = await insertMember(tx);
			const queued = await register(tx, late.id, event.id, speed.id);
			const admin = await staff(tx, 'admin');
			const ids = async (query: Record<string, string>) =>
				(await listRegistrations(tx, admin, event.id, state(query)))!.rows.map((r) => r.id);

			expect(await ids({})).toEqual([paid.registrationId, unpaid.registrationId, queued.id]);
			expect(await ids({ status: 'waitlist' })).toEqual([queued.id]);
			expect(await ids({ category: speed.id })).toEqual([queued.id]);
			expect(await ids({ paid: '1' })).toEqual([paid.registrationId]);
			expect(await ids({ paid: '0' })).toEqual([unpaid.registrationId, queued.id]);
			expect(await ids({ q: late.tag })).toEqual([queued.id]);
			expect(await ids({ status: 'bogus', category: 'nope' })).toHaveLength(3);
		});
	});

	it('unknown event — null; counts: seats held and the waitlist per event', async () => {
		await inRollback(async (tx) => {
			const moderator = await staff(tx, 'moderator');
			expect(await listRegistrations(tx, moderator, crypto.randomUUID(), state())).toBeNull();
			const event = await insertEvent(tx, { capacity: 1 });
			await register(tx, (await insertMember(tx)).id, event.id);
			await register(tx, (await insertMember(tx)).id, event.id);
			const empty = await insertEvent(tx);
			const counts = await registrationCounts(tx, [event.id, empty.id]);
			expect(counts.get(event.id)).toEqual({ seats: 1, waitlist: 1 });
			expect(counts.get(empty.id) ?? { seats: 0, waitlist: 0 }).toEqual({ seats: 0, waitlist: 0 });
		});
	});
});
