import { and, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { translate } from '#lib/i18n/translate.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { consents } from '../../db/schema/consents';
import { auditLog } from '../../db/schema/service';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import type { Mail } from '../../mail/resend';
import { approveConsent, rejectConsent } from './review';
import { bornYearsAgo, daysFromNow, insertConsent } from './test-support';

/* docs/05 section 10: approve or reject with a reason; the member gets a letter (decisions 5.2). */

const SITE = 'https://parkour.test';

function deps() {
	const sent: Mail[] = [];
	return { sent, send: async (mail: Mail) => void sent.push(mail), siteUrl: SITE, ip: '10.0.0.7' };
}

async function setup(tx: LimitDb, locale = 'en') {
	const member = await insertUser(tx, { birthDate: bornYearsAgo(12), locale });
	const moderator = await insertUser(tx, { role: 'moderator' });
	const consent = await insertConsent(tx, member.id);
	return { member, moderator: { id: moderator.id, role: 'moderator' as const }, consent };
}

const stored = async (tx: LimitDb, id: string) =>
	(await tx.select().from(consents).where(eq(consents.id, id)))[0];

const auditOf = (tx: LimitDb, actorId: string) =>
	tx.select().from(auditLog).where(and(eq(auditLog.actorId, actorId)));

describe.skipIf(!testDbUrl)('consents: review', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('a moderator approves: term, reviewer, audit on the member, a letter in their language', async () => {
		await inRollback(async (tx) => {
			const { member, moderator, consent } = await setup(tx, 'hy');
			const d = deps();
			const until = daysFromNow(200);
			expect(await approveConsent(tx, moderator, consent.id, { validUntil: until }, d)).toBe('ok');
			expect(await stored(tx, consent.id)).toMatchObject({
				status: 'approved',
				reviewedBy: moderator.id,
				validUntil: until,
				reviewNote: null
			});
			const [entry] = await auditOf(tx, moderator.id);
			expect(entry).toMatchObject({
				action: 'consent.approve',
				entityType: 'user',
				entityId: member.id,
				ip: '10.0.0.7'
			});
			expect(entry.after).toMatchObject({ consentId: consent.id, kind: 'parental' });
			expect(d.sent).toHaveLength(1);
			expect(d.sent[0].to).toBe(member.email);
			expect(d.sent[0].subject).toBe(translate('hy', 'consents.mail.approved.subject'));
			expect(d.sent[0].text).toContain(`${SITE}/hy/cabinet/documents`);
		});
	});

	it('an approval without a term is open-ended', async () => {
		await inRollback(async (tx) => {
			const { moderator, consent } = await setup(tx);
			expect(await approveConsent(tx, moderator, consent.id, { validUntil: null }, deps())).toBe(
				'ok'
			);
			expect((await stored(tx, consent.id)).validUntil).toBeNull();
		});
	});

	it('a refusal keeps the reason, shown to the member and sent in the letter', async () => {
		await inRollback(async (tx) => {
			const { member, moderator, consent } = await setup(tx);
			const d = deps();
			const note = 'The signature is missing';
			expect(await rejectConsent(tx, moderator, consent.id, { note }, d)).toBe('ok');
			expect(await stored(tx, consent.id)).toMatchObject({
				status: 'rejected',
				reviewedBy: moderator.id,
				reviewNote: note
			});
			const [entry] = await auditOf(tx, moderator.id);
			expect(entry).toMatchObject({ action: 'consent.reject', entityId: member.id });
			expect(d.sent[0].subject).toBe(translate('en', 'consents.mail.rejected.subject'));
			expect(d.sent[0].text).toContain(note);
		});
	});

	it('only a pending consent is decided; nothing is logged or sent otherwise', async () => {
		await inRollback(async (tx) => {
			const { member, moderator } = await setup(tx);
			for (const status of ['approved', 'rejected', 'expired'] as const) {
				const done = await insertConsent(tx, member.id, { status });
				const d = deps();
				expect(await approveConsent(tx, moderator, done.id, { validUntil: null }, d)).toBe(
					'wrong_status'
				);
				expect(await rejectConsent(tx, moderator, done.id, { note: 'x' }, d)).toBe(
					'wrong_status'
				);
				expect((await stored(tx, done.id)).status).toBe(status);
				expect(d.sent).toHaveLength(0);
			}
			expect(await auditOf(tx, moderator.id)).toHaveLength(0);
		});
	});

	it('an editor or a member may not decide; unknown, malformed or deleted — not found', async () => {
		await inRollback(async (tx) => {
			const { member, moderator, consent } = await setup(tx);
			for (const role of ['editor', 'member'] as const) {
				const actor = await insertUser(tx, { role });
				const d = deps();
				const actorRef = { id: actor.id, role };
				expect(await approveConsent(tx, actorRef, consent.id, { validUntil: null }, d)).toBe(
					'not_allowed'
				);
				expect(await rejectConsent(tx, actorRef, consent.id, { note: 'x' }, d)).toBe(
					'not_allowed'
				);
			}
			expect((await stored(tx, consent.id)).status).toBe('pending');
			const d = deps();
			const none = { validUntil: null };
			expect(await approveConsent(tx, moderator, crypto.randomUUID(), none, d)).toBe('not_found');
			expect(await approveConsent(tx, moderator, 'nope', none, d)).toBe('not_found');
			const gone = await insertUser(tx, { deletedAt: new Date(), birthDate: bornYearsAgo(12) });
			const orphan = await insertConsent(tx, gone.id);
			expect(await approveConsent(tx, moderator, orphan.id, none, d)).toBe('not_found');
			expect(member.id).toBeTruthy();
		});
	});

	it('a failed letter does not undo the decision', async () => {
		await inRollback(async (tx) => {
			const { moderator, consent } = await setup(tx);
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const failing = {
				...deps(),
				send: async () => {
					throw new Error('mail is down');
				}
			};
			expect(await approveConsent(tx, moderator, consent.id, { validUntil: null }, failing)).toBe(
				'ok'
			);
			expect(warn).toHaveBeenCalled();
			warn.mockRestore();
			expect((await stored(tx, consent.id)).status).toBe('approved');
		});
	});
});
