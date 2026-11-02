import { eq, inArray } from 'drizzle-orm';
import {
	partnerCashiers,
	volunteerPartners,
	volunteerPerks
} from '../../db/schema/volunteer-partners';
import { volunteerInvitations, volunteerRequests } from '../../db/schema/volunteer-requests';
import { raceDb } from '../registrations/race-support';
import { applyForCard } from './card-apply';
import { decideCard } from './card-decision';
import { bindCashier, findCashier, type Cashier } from './cashier-access';
import { createCashier } from './cashiers-admin';
import { createPartner } from './partners-admin';
import { createRequest, type RequestValues } from './requests-admin';
import {
	cardDeps as deps,
	cardRow,
	daysFromNow,
	IP,
	mailbox,
	partnerValues,
	perkValues
} from './test-support';

/* Test support only: simultaneous marks and accepts commit (registrations/race-support.ts).
 * Redemptions are append-only — left in the DB; partners archived, users soft-deleted;
 * invitations and requests of these races are deleted. */

export function volunteerRaceDb(sessions = 3) {
	const base = raceDb(sessions);
	const { main, race, cleanup: baseCleanup } = base;
	const partnerIds: string[] = [];
	const requestIds: string[] = [];

	async function cleanup() {
		if (requestIds.length) {
			await main
				.delete(volunteerInvitations)
				.where(inArray(volunteerInvitations.requestId, requestIds));
			await main.delete(volunteerRequests).where(inArray(volunteerRequests.id, requestIds));
		}
		if (partnerIds.length) {
			await main
				.update(partnerCashiers)
				.set({ disabledAt: new Date() })
				.where(inArray(partnerCashiers.partnerId, partnerIds));
			await main
				.update(volunteerPerks)
				.set({ status: 'archived' })
				.where(inArray(volunteerPerks.partnerId, partnerIds));
			await main
				.update(volunteerPartners)
				.set({ status: 'archived' })
				.where(inArray(volunteerPartners.id, partnerIds));
		}
		await baseCleanup();
	}

	async function issuedMember() {
		const admin = await base.staff('admin');
		const user = await base.member({ avatarKey: `avatars/${crypto.randomUUID()}.jpg` });
		const applied = await applyForCard(main, user.id, deps(mailbox().send));
		if (!applied.ok) throw new Error(applied.reason);
		await decideCard(main, admin, applied.id, { action: 'issue' }, deps(mailbox().send));
		const row = await cardRow(main, applied.id);
		return { admin, user, cardId: applied.id, token: row.publicToken! };
	}

	async function boundCashier(admin: { id: string; role: string }, partnerId: string) {
		const actor = { id: admin.id, role: admin.role as 'admin' };
		const created = await createCashier(
			main,
			actor,
			partnerId,
			`Till ${crypto.randomUUID().slice(0, 6)}`,
			null
		);
		if (typeof created === 'string') throw new Error(created);
		const device = await bindCashier(main, created.token);
		const cashier = await findCashier(main, device);
		if (!cashier) throw new Error('no cashier');
		return cashier;
	}

	/** One published partner, a single perk with `usesLimit`, an issued card and two bound cashiers. */
	async function singlePerkScene(usesLimit = 1) {
		const { admin, cardId, token } = await issuedMember();
		const partner = await createPartner(main, admin, partnerValues({ status: 'published' }), null);
		if (typeof partner === 'string') throw new Error(partner);
		partnerIds.push(partner.id);
		const [perk] = await main
			.insert(volunteerPerks)
			.values({
				...perkValues({ status: 'published', kind: 'single', usesLimit }),
				partnerId: partner.id
			})
			.returning({ id: volunteerPerks.id });
		const cashiers: Cashier[] = [
			await boundCashier(admin, partner.id),
			await boundCashier(admin, partner.id)
		];
		return { token, perkId: perk.id, partnerId: partner.id, cardId, cashiers };
	}

	async function openInvite(places = 1) {
		const admin = await base.staff('admin');
		const users = [await issuedMember(), await issuedMember()].map((m) => m.user);
		const values: RequestValues = {
			title: { en: `Race ${crypto.randomUUID().slice(0, 8)}` },
			description: null,
			eventId: null,
			startsAt: daysFromNow(5),
			endsAt: daysFromNow(5.2),
			location: null,
			places,
			respondBy: daysFromNow(2)
		};
		const created = await createRequest(main, admin, values, IP);
		if (typeof created === 'string') throw new Error(created);
		requestIds.push(created.id);
		/* Only these two seats — publishRequest would invite every valid card in the shared DB. */
		await main
			.update(volunteerRequests)
			.set({ status: 'open' })
			.where(eq(volunteerRequests.id, created.id));
		const invites = await main
			.insert(volunteerInvitations)
			.values(
				users.map((u) => ({ requestId: created.id, userId: u.id, status: 'invited' as const }))
			)
			.returning({ id: volunteerInvitations.id, userId: volunteerInvitations.userId });
		const byUser = Object.fromEntries(invites.map((i) => [i.userId, i.id]));
		return { admin, users, requestId: created.id, byUser };
	}

	return { main, race, cleanup, singlePerkScene, openInvite, issuedMember };
}
