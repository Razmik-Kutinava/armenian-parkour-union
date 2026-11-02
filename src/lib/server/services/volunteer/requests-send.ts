import { and, eq, isNotNull, isNull, not, notExists } from 'drizzle-orm';
import type { LocalizedText } from '#lib/i18n/localized.ts';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { users } from '../../db/schema/users';
import { volunteerCards } from '../../db/schema/volunteer-cards';
import { volunteerInvitations, volunteerRequests } from '../../db/schema/volunteer-requests';
import type { Mail } from '../../mail/resend';
import { writeAudit } from '../audit';
import { isUuid, type Actor } from '../users/target';
import type { CardRecipient } from './card-mail';
import { minorSql, paidUntilSql, privacySql } from './card-sql';
import { cancelAcceptedLetter, inviteLetter } from './request-mail';

/* docs/03 section 19.5 pp. 2, 6, 19.9: publish, invite more, cancel. */

export type CardDeps = {
	send: (mail: Mail) => Promise<void>;
	siteUrl: string | undefined;
	ip: string | null;
	now?: Date;
};

const canManage = (actor: Actor) => roleCan(actor.role, 'volunteer.manage');

const validCardSql = (now: Date) =>
	and(
		eq(volunteerCards.status, 'active'),
		eq(users.status, 'active'),
		isNull(users.deletedAt),
		isNotNull(paidUntilSql(now)),
		not(and(minorSql(now), not(privacySql(now)))!)
	)!;

async function eligibleRecipients(tx: LimitDb, requestId: string, now: Date) {
	return tx
		.select({
			userId: users.id,
			email: users.email,
			locale: users.locale,
			firstName: users.firstName,
			lastName: users.lastName,
			name: users.name
		})
		.from(volunteerCards)
		.innerJoin(users, eq(users.id, volunteerCards.userId))
		.where(
			and(
				validCardSql(now),
				notExists(
					tx
						.select({ id: volunteerInvitations.id })
						.from(volunteerInvitations)
						.where(
							and(
								eq(volunteerInvitations.requestId, requestId),
								eq(volunteerInvitations.userId, users.id)
							)
						)
				)
			)
		);
}

async function sendAll(deps: CardDeps, letters: Mail[], label: string) {
	for (const letter of letters) {
		await deps.send(letter).catch((e) => console.warn(`volunteer request ${label}: letter`, e));
	}
}

async function inviteBatch(
	tx: LimitDb,
	actor: Actor,
	row: typeof volunteerRequests.$inferSelect,
	action: 'volunteer_request.publish' | 'volunteer_request.invite_more',
	deps: CardDeps,
	now: Date
) {
	const recipients = await eligibleRecipients(tx, row.id, now);
	if (recipients.length) {
		await tx
			.insert(volunteerInvitations)
			.values(recipients.map((r) => ({ requestId: row.id, userId: r.userId })));
	}
	const title = row.title as LocalizedText;
	const letters = recipients.map((r) => inviteLetter(r as CardRecipient, title, deps.siteUrl));
	if (action === 'volunteer_request.publish') {
		await tx
			.update(volunteerRequests)
			.set({ status: 'open', publishedAt: now })
			.where(eq(volunteerRequests.id, row.id));
	}
	await writeAudit(tx, {
		actorId: actor.id,
		action,
		entityType: 'volunteer_request',
		entityId: row.id,
		after: { invited: recipients.length },
		ip: deps.ip
	});
	return { invited: recipients.length, letters };
}

export async function publishRequest(db: LimitDb, actor: Actor, id: string, deps: CardDeps) {
	if (!canManage(actor)) return { ok: false as const, reason: 'not_allowed' as const };
	if (!isUuid(id)) return { ok: false as const, reason: 'not_found' as const };
	const now = deps.now ?? new Date();
	const outcome = await db.transaction(async (tx) => {
		const [row] = await tx
			.select()
			.from(volunteerRequests)
			.where(eq(volunteerRequests.id, id))
			.for('update');
		if (!row) return { ok: false as const, reason: 'not_found' as const };
		if (row.status !== 'draft') return { ok: false as const, reason: 'bad_state' as const };
		const batch = await inviteBatch(tx, actor, row, 'volunteer_request.publish', deps, now);
		return { ok: true as const, invited: batch.invited, letters: batch.letters };
	});
	if (!outcome.ok) return outcome;
	await sendAll(deps, outcome.letters, id);
	return { ok: true as const, invited: outcome.invited };
}

export async function inviteMore(db: LimitDb, actor: Actor, id: string, deps: CardDeps) {
	if (!canManage(actor)) return { ok: false as const, reason: 'not_allowed' as const };
	if (!isUuid(id)) return { ok: false as const, reason: 'not_found' as const };
	const now = deps.now ?? new Date();
	const outcome = await db.transaction(async (tx) => {
		const [row] = await tx
			.select()
			.from(volunteerRequests)
			.where(eq(volunteerRequests.id, id))
			.for('update');
		if (!row) return { ok: false as const, reason: 'not_found' as const };
		if (row.status !== 'open') return { ok: false as const, reason: 'bad_state' as const };
		if (row.respondBy <= now) return { ok: false as const, reason: 'respond_by' as const };
		const batch = await inviteBatch(tx, actor, row, 'volunteer_request.invite_more', deps, now);
		return { ok: true as const, invited: batch.invited, letters: batch.letters };
	});
	if (!outcome.ok) return outcome;
	await sendAll(deps, outcome.letters, id);
	return { ok: true as const, invited: outcome.invited };
}

export async function cancelRequest(db: LimitDb, actor: Actor, id: string, deps: CardDeps) {
	if (!canManage(actor)) return { ok: false as const, reason: 'not_allowed' as const };
	if (!isUuid(id)) return { ok: false as const, reason: 'not_found' as const };
	const outcome = await db.transaction(async (tx) => {
		const [row] = await tx
			.select()
			.from(volunteerRequests)
			.where(eq(volunteerRequests.id, id))
			.for('update');
		if (!row) return { ok: false as const, reason: 'not_found' as const };
		if (row.status !== 'draft' && row.status !== 'open') {
			return { ok: false as const, reason: 'bad_state' as const };
		}
		const accepted = await tx
			.select({
				email: users.email,
				locale: users.locale,
				firstName: users.firstName,
				lastName: users.lastName,
				name: users.name
			})
			.from(volunteerInvitations)
			.innerJoin(users, eq(users.id, volunteerInvitations.userId))
			.where(
				and(eq(volunteerInvitations.requestId, id), eq(volunteerInvitations.status, 'accepted'))
			);
		await tx
			.update(volunteerInvitations)
			.set({ status: 'excused' })
			.where(eq(volunteerInvitations.requestId, id));
		await tx
			.update(volunteerRequests)
			.set({ status: 'cancelled' })
			.where(eq(volunteerRequests.id, id));
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'volunteer_request.cancel',
			entityType: 'volunteer_request',
			entityId: id,
			before: { status: row.status },
			after: { status: 'cancelled' },
			ip: deps.ip
		});
		const title = row.title as LocalizedText;
		const letters =
			row.status === 'open'
				? accepted.map((m) => cancelAcceptedLetter(m, title, deps.siteUrl))
				: [];
		return { ok: true as const, letters };
	});
	if (!outcome.ok) return outcome;
	await sendAll(deps, outcome.letters, id);
	return { ok: true as const };
}

/** How many valid cards would get an invite now (confirm dialog before publish / invite more). */
export async function countNewInvites(db: LimitDb, requestId: string, now = new Date()) {
	if (!isUuid(requestId)) return 0;
	return (await eligibleRecipients(db, requestId, now)).length;
}
