import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { volunteerCards } from '../../db/schema/volunteer-cards';
import { testDb, testDbUrl } from '../../db/test-db';
import { auditFor } from '../memberships/test-support';
import { applyForCard } from './card-apply';
import { clearCardFlag } from './card-flag';
import { decideCard } from './card-decision';
import { parseVolunteerSettings, writeVolunteerSettings } from './settings';
import { cardDeps as deps, IP, mailbox, staff, volunteer } from './test-support';

/* docs/03 section 19.6 pp. 3–4: clear flag resets streak; admin only; audited. */

describe('volunteer settings: decline_threshold', () => {
	it('defaults to 3; stores a whole number from 1 to 20', () => {
		expect(parseVolunteerSettings(undefined).declineThreshold).toBe(3);
		expect(parseVolunteerSettings({ decline_threshold: 5, cashier_invite_hours: 24 })).toEqual({
			cashierInviteHours: 24,
			declineThreshold: 5
		});
		expect(parseVolunteerSettings({ decline_threshold: 0 }).declineThreshold).toBe(3);
		expect(parseVolunteerSettings({ decline_threshold: 21 }).declineThreshold).toBe(3);
	});
});

describe.skipIf(!testDbUrl)('volunteer card flag clear', { timeout: 60_000 }, () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('admin clears the mark: streak 0, flagged_at null, audited', async () => {
		await inRollback(async (tx) => {
			await writeVolunteerSettings(tx, { declineThreshold: 3, cashierInviteHours: 72 });
			const admin = await staff(tx);
			const user = await volunteer(tx);
			const applied = await applyForCard(tx, user.id, deps(mailbox().send));
			if (!applied.ok) throw new Error(applied.reason);
			await decideCard(tx, admin, applied.id, { action: 'issue' }, deps(mailbox().send));
			await tx
				.update(volunteerCards)
				.set({ declineStreak: 4, flaggedAt: new Date() })
				.where(eq(volunteerCards.id, applied.id));
			expect(await clearCardFlag(tx, admin, applied.id, IP)).toEqual({ ok: true });
			const [row] = await tx
				.select()
				.from(volunteerCards)
				.where(eq(volunteerCards.id, applied.id));
			expect(row).toMatchObject({ declineStreak: 0, flaggedAt: null });
			expect(await auditFor(tx, 'volunteer_card', applied.id)).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						action: 'volunteer_card.unflag',
						actorId: admin.id,
						ip: IP
					})
				])
			);
			expect(await clearCardFlag(tx, admin, applied.id, IP)).toEqual({
				ok: false,
				reason: 'bad_state'
			});
			const mod = await staff(tx, 'moderator');
			await tx
				.update(volunteerCards)
				.set({ declineStreak: 3, flaggedAt: new Date() })
				.where(eq(volunteerCards.id, applied.id));
			expect(await clearCardFlag(tx, mod, applied.id, IP)).toEqual({
				ok: false,
				reason: 'not_allowed'
			});
		});
	});
});
