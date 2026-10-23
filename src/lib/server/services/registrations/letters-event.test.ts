import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { translate } from '#lib/i18n/translate.ts';
import { formatPrice } from '#lib/money.ts';
import { eventRegistrations } from '../../db/schema/registrations';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { cancelEvent } from '../events/lifecycle';
import { createMockProvider } from '../payments/providers/mock';
import { paymentRow } from '../payments/test-support';
import { feeEffects, paidEvent, payStarted, settleFee } from './pay-support';
import { SITE, insertMember, mailbox, registerOk, registrationOf } from './test-support';

/* docs/07 sections 5.3 p. 3, 12 p. 1: the counted fee — one letter with the receipt; docs/03
 * section 7 p. 8, 14: the cancelled event — a letter to every member whose registration went. */

const IP = '198.51.100.7';
const REFUND = translate('en', 'registrations.mail.eventCancelled.refund');

describe.skipIf(!testDbUrl)('registrations: letters on payment and event cancel', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('the fee is counted: one letter with the amount and the payment number; a repeat — none', async () => {
		await inRollback(async (tx) => {
			const mock = createMockProvider();
			const box = mailbox();
			const event = await paidEvent(tx);
			const { member, payment } = await payStarted(tx, mock, event.id);
			expect(await settleFee(tx, mock, payment.id, 'paid', feeEffects(box.send))).toBe('applied');
			expect(await settleFee(tx, mock, payment.id, 'paid', feeEffects(box.send))).toBe('unchanged');
			expect(box.sent).toHaveLength(1);
			const [letter] = box.sent;
			expect(letter.to).toBe(member.email);
			expect(letter.subject).toBe(
				translate('en', 'registrations.mail.paid.subject', { event: 'Spring jam' })
			);
			const row = await paymentRow(tx, payment.id);
			expect(letter.text).toContain(formatPrice(row.amountMinor, row.currency, 'en'));
			expect(letter.text).toContain(payment.id);
			expect(letter.text).toContain(`${SITE}/cabinet/events`);
		});
	});

	it('paid late without a seat: no letter to the member (the admin decides)', async () => {
		await inRollback(async (tx) => {
			const mock = createMockProvider();
			const box = mailbox();
			const event = await paidEvent(tx, { capacity: 1 });
			const { registrationId, payment } = await payStarted(tx, mock, event.id);
			await tx
				.update(eventRegistrations)
				.set({ status: 'cancelled', holdUntil: null })
				.where(eq(eventRegistrations.id, registrationId));
			await registerOk(tx, (await insertMember(tx)).id, event.id);
			expect(await settleFee(tx, mock, payment.id, 'paid', feeEffects(box.send))).toBe('applied');
			expect((await paymentRow(tx, payment.id)).needsReview).toBe(true);
			expect(box.sent).toEqual([]);
		});
	});

	it('the event is cancelled: each cancelled member gets a letter, the paid one — about the refund', async () => {
		await inRollback(async (tx) => {
			const admin = { id: (await insertUser(tx, { role: 'admin' })).id, role: 'admin' as const };
			const mock = createMockProvider();
			const event = await paidEvent(tx, { capacity: 3 });
			const paid = await payStarted(tx, mock, event.id);
			await settleFee(tx, mock, paid.payment.id, 'paid', feeEffects());
			const unpaid = await payStarted(tx, mock, event.id);
			const cameMember = await insertMember(tx);
			const came = await registerOk(tx, cameMember.id, event.id);
			await tx
				.update(eventRegistrations)
				.set({ status: 'attended' })
				.where(eq(eventRegistrations.id, came.id));
			const queuedMember = await insertMember(tx, { locale: 'ru' });
			await registerOk(tx, queuedMember.id, event.id);

			const box = mailbox();
			const mail = { send: box.send, siteUrl: SITE };
			expect(await cancelEvent(tx, admin, event.id, 'Bad weather', IP, mail)).toBe('ok');
			const to = (email: string) => box.sent.find((m) => m.to === email)!;
			expect(box.sent.map((m) => m.to).sort()).toEqual(
				[paid.member.email, unpaid.member.email, queuedMember.email].sort()
			);
			expect(to(paid.member.email).subject).toBe(
				translate('en', 'registrations.mail.eventCancelled.subject', { event: 'Spring jam' })
			);
			expect(to(paid.member.email).text).toContain(REFUND);
			expect(to(unpaid.member.email).text).not.toContain(REFUND);
			expect(to(queuedMember.email).subject).toBe(
				translate('ru', 'registrations.mail.eventCancelled.subject', { event: 'Весенний джем' })
			);
			expect(to(queuedMember.email).text).toContain(`${SITE}/ru/cabinet/events`);
			for (const m of box.sent) expect(m.text).not.toContain('Bad weather');
		});
	});

	it('the mail service is down: the event is cancelled all the same', async () => {
		await inRollback(async (tx) => {
			const admin = { id: (await insertUser(tx, { role: 'admin' })).id, role: 'admin' as const };
			const event = await paidEvent(tx, { priceAmountMinor: 0 });
			const { id } = await registerOk(tx, (await insertMember(tx)).id, event.id);
			const mail = { send: mailbox(true).send, siteUrl: SITE };
			expect(await cancelEvent(tx, admin, event.id, 'Storm', IP, mail)).toBe('ok');
			expect((await registrationOf(tx, id)).status).toBe('cancelled');
		});
	});
});
