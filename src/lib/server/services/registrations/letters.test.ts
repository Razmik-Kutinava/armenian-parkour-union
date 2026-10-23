import { afterAll, describe, expect, it } from 'vitest';
import { translate } from '#lib/i18n/translate.ts';
import { testDb, testDbUrl } from '../../db/test-db';
import { registerForEvent } from './register';
import { insertEvent, insertMember, mailbox, registrationOf, SETTINGS, SITE } from './test-support';

/* docs/03 section 14: a registration on the site is confirmed by a letter after the commit, in the
 * member's language, with a link to their events (docs/06 section 6); a lost letter loses nothing. */

const subject = (locale: 'en' | 'ru', key: 'confirmed' | 'waitlist', event: string) =>
	translate(locale, `registrations.mail.${key}.subject`, { event });

describe.skipIf(!testDbUrl)('registrations: letters on registering', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	const deps = (box = mailbox()) => ({ settings: SETTINGS, send: box.send, siteUrl: SITE });
	const input = (eventId: string) => ({ eventId, categoryId: null });

	it('registered: a confirmation in the member’s language with a link to their events', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx);
			const member = await insertMember(tx, { locale: 'ru' });
			const box = mailbox();
			const result = await registerForEvent(tx, member.id, input(event.id), deps(box));
			expect(result).toMatchObject({ ok: true, status: 'registered' });
			expect(box.sent).toHaveLength(1);
			expect(box.sent[0].to).toBe(member.email);
			expect(box.sent[0].subject).toBe(subject('ru', 'confirmed', 'Весенний джем'));
			expect(box.sent[0].text).toContain(`${SITE}/ru/cabinet/events`);
		});
	});

	it('waitlist: a letter that the member is in line', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx, { capacity: 1 });
			await registerForEvent(tx, (await insertMember(tx)).id, input(event.id), deps());
			const member = await insertMember(tx);
			const box = mailbox();
			const result = await registerForEvent(tx, member.id, input(event.id), deps(box));
			expect(result).toMatchObject({ ok: true, status: 'waitlist' });
			expect(box.sent.map((m) => [m.to, m.subject])).toEqual([
				[member.email, subject('en', 'waitlist', 'Spring jam')]
			]);
			expect(box.sent[0].text).toContain(`${SITE}/cabinet/events`);
		});
	});

	it('a paid seat waiting for the payment, or a refusal: no letter', async () => {
		await inRollback(async (tx) => {
			const paid = await insertEvent(tx, { priceAmountMinor: 5000 });
			const member = await insertMember(tx);
			const box = mailbox();
			const held = await registerForEvent(tx, member.id, input(paid.id), deps(box));
			expect(held).toMatchObject({ ok: true, status: 'pending_payment' });
			const again = await registerForEvent(tx, member.id, input(paid.id), deps(box));
			expect(again).toMatchObject({ ok: false, reason: 'already_registered' });
			expect(box.sent).toEqual([]);
		});
	});

	it('the mail service is down: the registration stays', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx);
			const member = await insertMember(tx);
			const result = await registerForEvent(tx, member.id, input(event.id), deps(mailbox(true)));
			if (!result.ok) throw new Error(result.reason);
			expect((await registrationOf(tx, result.id)).status).toBe('registered');
		});
	});
});
