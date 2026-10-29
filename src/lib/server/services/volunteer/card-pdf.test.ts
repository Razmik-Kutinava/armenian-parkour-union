import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { consume, limits, type LimitDb } from '../../auth/rate-limit';
import { testDb, testDbUrl } from '../../db/test-db';
import { users } from '../../db/schema/users';
import { volunteerPartners, volunteerPerks } from '../../db/schema/volunteer-partners';
import { applyForCard } from './card-apply';
import { decideCard } from './card-decision';
import { cardPdfData, cardPdfFile } from './card-pdf';
import { cardRow, cardDeps as deps, mailbox, partnerValues, perkValues, SITE, staff, volunteer } from './test-support';

/* docs/03 sections 19.2 p. 3, 19.8: a PDF of a valid card only — for the owner (id from the session)
 * and for an admin from the card page; the QR leads to the Armenian check page. */

const LATER = new Date(Date.now() + 400 * 86_400_000);

async function issued(tx: LimitDb) {
	const admin = await staff(tx);
	const user = await volunteer(tx, { firstName: 'Aram', lastName: 'Petrosyan' });
	const applied = await applyForCard(tx, user.id, deps(mailbox().send));
	if (!applied.ok) throw new Error(applied.reason);
	await decideCard(tx, admin, applied.id, { action: 'issue' }, deps(mailbox().send));
	return { admin, userId: user.id, cardId: applied.id, row: await cardRow(tx, applied.id) };
}

const noImages = { toUrl: () => null, fetch: async () => new Response(null, { status: 404 }) };

describe.skipIf(!testDbUrl)('volunteer card PDF', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('a valid card, by the owner or by the card id: what goes into the PDF', async () => {
		await inRollback(async (tx) => {
			const { userId, cardId, row } = await issued(tx);
			const [partner] = await tx
				.insert(volunteerPartners)
				.values(partnerValues({ status: 'published' }))
				.returning({ id: volunteerPartners.id });
			await tx
				.insert(volunteerPerks)
				.values({ ...perkValues({ status: 'published' }), partnerId: partner.id });

			const data = await cardPdfData(tx, { userId }, SITE);
			expect(data).toMatchObject({
				number: row.number,
				holder: 'Aram Petrosyan',
				avatarKey: expect.stringMatching(/^avatars\//),
				checkUrl: `${SITE}/hy/volunteer/${row.publicToken}`
			});
			expect(data?.validUntil).toBeInstanceOf(Date);
			expect(data?.partners.some((p) => p.id === partner.id)).toBe(true);
			expect(await cardPdfData(tx, { cardId }, `${SITE}/`)).toMatchObject({
				number: row.number,
				checkUrl: `${SITE}/hy/volunteer/${row.publicToken}`
			});
		});
	});

	it('no PDF: pending, membership over, blocked, deleted, unknown', async () => {
		await inRollback(async (tx) => {
			const pending = await volunteer(tx);
			const applied = await applyForCard(tx, pending.id, deps(mailbox().send));
			if (!applied.ok) throw new Error(applied.reason);
			expect(await cardPdfData(tx, { userId: pending.id }, SITE)).toBeNull();
			expect(await cardPdfData(tx, { cardId: applied.id }, SITE)).toBeNull();

			const { userId, cardId } = await issued(tx);
			expect(await cardPdfData(tx, { userId }, SITE, LATER)).toBeNull();
			await tx.update(users).set({ status: 'blocked' }).where(eq(users.id, userId));
			expect(await cardPdfData(tx, { cardId }, SITE)).toBeNull();
			await tx.update(users).set({ deletedAt: new Date() }).where(eq(users.id, userId));
			expect(await cardPdfData(tx, { userId }, SITE)).toBeNull();

			expect(await cardPdfData(tx, { cardId: crypto.randomUUID() }, SITE)).toBeNull();
			expect(await cardPdfData(tx, { cardId: 'nope' }, SITE)).toBeNull();
			expect(await cardPdfData(tx, { userId: 'nope' }, SITE)).toBeNull();
		});
	});

	it('the file: a PDF named by the number; another one refused', async () => {
		await inRollback(async (tx) => {
			const { userId, row } = await issued(tx);
			const file = await cardPdfFile(tx, { userId }, { actorId: userId, locale: 'hy', siteUrl: SITE, ...noImages });
			if (!file.ok) throw new Error(file.reason);
			expect(file.number).toBe(row.number);
			expect(new TextDecoder().decode(file.bytes.slice(0, 5))).toBe('%PDF-');
			const other = await volunteer(tx);
			const refused = await cardPdfFile(tx, { userId: other.id }, { actorId: other.id, locale: 'en', siteUrl: SITE, ...noImages });
			expect(refused).toEqual({ ok: false, reason: 'not_found' });
		});
	});

	it('over the hourly limit of the person downloading — limited, nothing drawn', async () => {
		await inRollback(async (tx) => {
			const { userId, admin } = await issued(tx);
			for (let i = 0; i < limits.volunteerPdfPerUser.max; i++) {
				await consume(tx, `volunteer-pdf:user:${admin.id}`, limits.volunteerPdfPerUser);
			}
			const refused = await cardPdfFile(tx, { userId }, { actorId: admin.id, locale: 'en', siteUrl: SITE, ...noImages });
			expect(refused).toEqual({ ok: false, reason: 'limited' });
		});
	});
});
