import { afterAll, describe, expect, it } from 'vitest';
import { translate } from '#lib/i18n/translate.ts';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { createMockProvider } from '../payments/providers/mock';
import { expireHold, feeEffects, paidEvent, payStarted, settleFee } from './pay-support';
import { releaseExpiredHolds } from './release';
import { addRegistration } from './staff/add';
import { cancelRegistrationByStaff } from './staff/cancel';
import {
	SITE,
	cancelDeps,
	insertEvent,
	insertMember,
	mailbox,
	registerOk,
	registrationOf
} from './test-support';

/* Owner's answer 2026-10-26 (questions.md, stage 5): the member gets a letter when staff add them by
 * hand, when staff cancel their registration, and when an unpaid seat is given back (docs/03 7.4). */

const IP = '198.51.100.7';
const REFUND = translate('en', 'registrations.mail.eventCancelled.refund');
type Tx = Parameters<typeof insertUser>[0];
const moderator = async (tx: Tx) => ({
	id: (await insertUser(tx, { role: 'moderator' })).id,
	role: 'moderator' as const
});

describe.skipIf(!testDbUrl)('registrations: letters on staff actions and unpaid holds', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('added by hand: "you are registered" in the member’s language; a refusal — none', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx, { capacity: 1 });
			const member = await insertMember(tx, { locale: 'ru' });
			const actor = await moderator(tx);
			const box = mailbox();
			const mail = { send: box.send, siteUrl: SITE };
			const add = (who: string) =>
				addRegistration(tx, actor, { eventId: event.id, member: who, categoryId: null }, IP, mail);

			expect(await add(member.id)).toMatchObject({ ok: true });
			expect(await add((await insertMember(tx)).id)).toEqual({ ok: false, reason: 'full' });
			expect(box.sent.map((m) => [m.to, m.subject])).toEqual([
				[
					member.email,
					translate('ru', 'registrations.mail.confirmed.subject', { event: 'Весенний джем' })
				]
			]);
			expect(box.sent[0].text).toContain(`${SITE}/ru/cabinet/events`);
		});
	});

	it('cancelled by staff: a letter without the staff reason; the paid one — about the refund', async () => {
		await inRollback(async (tx) => {
			const mock = createMockProvider();
			const event = await paidEvent(tx, { capacity: 3 });
			const paid = await payStarted(tx, mock, event.id);
			await settleFee(tx, mock, paid.payment.id, 'paid', feeEffects());
			const unpaid = await payStarted(tx, mock, event.id);
			const actor = await moderator(tx);
			const box = mailbox();
			for (const registrationId of [paid.registrationId, unpaid.registrationId]) {
				const ref = { eventId: event.id, registrationId, reason: 'Asked by phone' };
				const result = await cancelRegistrationByStaff(tx, actor, ref, cancelDeps(box), IP);
				expect(result).toBe('ok');
			}
			const to = (email: string) => box.sent.find((m) => m.to === email)!;
			const subject = translate('en', 'registrations.mail.staffCancelled.subject', {
				event: 'Spring jam'
			});
			expect(to(paid.member.email).subject).toBe(subject);
			expect(to(unpaid.member.email).subject).toBe(subject);
			expect(to(paid.member.email).text).toContain(REFUND);
			expect(to(unpaid.member.email).text).not.toContain(REFUND);
			expect(to(paid.member.email).text).toContain(`${SITE}/cabinet/events`);
			for (const m of box.sent) expect(m.text).not.toContain('Asked by phone');
		});
	});

	it('a place in line cancelled by staff: the member is told too', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx, { capacity: 1 });
			await registerOk(tx, (await insertMember(tx)).id, event.id);
			const queued = await insertMember(tx);
			const { id } = await registerOk(tx, queued.id, event.id);
			const box = mailbox();
			const ref = { eventId: event.id, registrationId: id, reason: 'Duplicate' };
			expect(await cancelRegistrationByStaff(tx, await moderator(tx), ref, cancelDeps(box), IP)).toBe(
				'ok'
			);
			expect(box.sent.map((m) => m.to)).toEqual([queued.email]);
		});
	});

	it('the hold ran out unpaid: the member is told the seat went on, with the event page', async () => {
		await inRollback(async (tx) => {
			const event = await paidEvent(tx, { capacity: 1 });
			const late = await insertMember(tx, { locale: 'ru' });
			const next = await insertMember(tx);
			const held = await registerOk(tx, late.id, event.id);
			await registerOk(tx, next.id, event.id);
			await expireHold(tx, held.id);
			const box = mailbox();
			await releaseExpiredHolds(tx, cancelDeps(box));
			const letter = box.sent.find((m) => m.to === late.email);
			expect(letter?.subject).toBe(
				translate('ru', 'registrations.mail.holdExpired.subject', { event: 'Весенний джем' })
			);
			expect(letter?.text).toContain(`${SITE}/ru/events/${event.slug}`);
			expect(box.sent.some((m) => m.to === next.email)).toBe(true);
		});
	});

	it('a hold left to reconciliation: no letter', async () => {
		await inRollback(async (tx) => {
			const event = await paidEvent(tx);
			const started = await payStarted(tx, createMockProvider(), event.id);
			await expireHold(tx, started.registrationId);
			const box = mailbox();
			await releaseExpiredHolds(tx, cancelDeps(box));
			expect(box.sent.some((m) => m.to === started.member.email)).toBe(false);
		});
	});

	it('the mail service is down: the add, the cancel and the release stay', async () => {
		await inRollback(async (tx) => {
			const event = await paidEvent(tx, { capacity: 3 });
			const actor = await moderator(tx);
			const down = cancelDeps(mailbox(true));
			const input = { eventId: event.id, member: (await insertMember(tx)).id, categoryId: null };
			const added = await addRegistration(tx, actor, input, IP, down);
			if (!added.ok) throw new Error(added.reason);
			expect((await registrationOf(tx, added.id)).status).toBe('registered');
			const ref = { eventId: event.id, registrationId: added.id, reason: 'Moved' };
			expect(await cancelRegistrationByStaff(tx, actor, ref, down, IP)).toBe('ok');
			const held = await registerOk(tx, (await insertMember(tx)).id, event.id);
			await expireHold(tx, held.id);
			await releaseExpiredHolds(tx, down);
			expect((await registrationOf(tx, held.id)).status).toBe('cancelled');
		});
	});
});
