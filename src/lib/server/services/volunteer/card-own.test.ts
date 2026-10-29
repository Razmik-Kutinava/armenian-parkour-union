import { afterAll, describe, expect, it } from 'vitest';
import { testDb, testDbUrl } from '../../db/test-db';
import { applyForCard } from './card-apply';
import { decideCard } from './card-decision';
import { ownCard } from './card-own';
import { volunteerPartners, volunteerPerks } from '../../db/schema/volunteer-partners';
import {
	addMembership,
	cardRow,
	cardDeps as deps,
	mailbox,
	partnerValues,
	perkValues,
	staff,
	volunteer
} from './test-support';

/* docs/06 section 5.12 "Card": every state of the block; the member id comes from the session. */

describe.skipIf(!testDbUrl)('volunteer card in the cabinet', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('no card: what is missing to apply, nothing else', async () => {
		await inRollback(async (tx) => {
			const ready = await volunteer(tx);
			expect(await ownCard(tx, ready.id)).toEqual({
				card: null,
				missing: [],
				validity: null,
				checkToken: null,
				partners: []
			});
			const bare = await volunteer(tx, { member: false, avatarKey: null });
			expect((await ownCard(tx, bare.id)).missing).toEqual(['membership', 'photo']);
		});
	});

	it('pending, then rejected with the reason; another member sees nothing of it', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const user = await volunteer(tx);
			const applied = await applyForCard(tx, user.id, deps(mailbox().send));
			if (!applied.ok) throw new Error(applied.reason);
			expect((await ownCard(tx, user.id)).card).toMatchObject({ status: 'pending', number: null });
			const reject = { action: 'reject' as const, reason: 'Фото размыто' };
			await decideCard(tx, admin, applied.id, reject, deps(mailbox().send));
			const view = await ownCard(tx, user.id);
			expect(view.card).toMatchObject({ status: 'rejected', reviewNote: 'Фото размыто' });
			expect(view.validity).toBeNull();
			const other = await volunteer(tx);
			expect((await ownCard(tx, other.id)).card).toBeNull();
		});
	});

	it('active: valid until the paid end, a renewal paid ahead included; membership over — why not', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const user = await volunteer(tx, { member: false });
			await addMembership(tx, user.id, -300, 30);
			await addMembership(tx, user.id, 30, 395);
			const applied = await applyForCard(tx, user.id, deps(mailbox().send));
			if (!applied.ok) throw new Error(applied.reason);
			await decideCard(tx, admin, applied.id, { action: 'issue' }, deps(mailbox().send));
			const [partner] = await tx
				.insert(volunteerPartners)
				.values(partnerValues({ status: 'published' }))
				.returning({ id: volunteerPartners.id });
			await tx
				.insert(volunteerPerks)
				.values({ ...perkValues({ status: 'published' }), partnerId: partner.id });
			const view = await ownCard(tx, user.id);
			expect(view.card?.number).toMatch(/^APU-V-/);
			if (!view.validity?.valid) throw new Error('not valid');
			const days = (view.validity.until.getTime() - Date.now()) / 86_400_000;
			expect(Math.round(days)).toBe(395);
			expect(view.checkToken).toBe((await cardRow(tx, applied.id)).publicToken);
			expect(view.partners.some((p) => p.id === partner.id)).toBe(true);
			const later = new Date(Date.now() + 400 * 86_400_000);
			const lapsed = await ownCard(tx, user.id, later);
			expect(lapsed.validity).toEqual({ valid: false, reasons: ['membership'] });
			expect(lapsed).toMatchObject({ checkToken: null, partners: [] });
		});
	});

	it('an unknown id: an empty view', async () => {
		await inRollback(async (tx) => {
			const empty = await ownCard(tx, 'nope');
			expect(empty.card).toBeNull();
		});
	});
});
