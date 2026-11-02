import { and, eq, isNull, lt } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { volunteerInvitations, volunteerRequests } from '../../db/schema/volunteer-requests';
import type { Mail } from '../../mail/resend';
import { isUuid } from '../users/target';
import { bumpDeclineStreak } from './card-flag';

/* docs/03 section 19.5 p. 4, 19.6: once per request after respond_by — expire silence (+1),
 * excuse leftover invites when seats are full (no streak), count declined (+1). */

export type CloseMailDeps = { send: (mail: Mail) => Promise<void>; siteUrl?: string };

async function sendLetters(deps: CloseMailDeps | undefined, letters: Mail[]) {
	if (!deps) return;
	for (const letter of letters) {
		await deps.send(letter).catch((e) => console.warn('volunteer close: letter', e));
	}
}

export async function closeRequestInvites(
	db: LimitDb,
	requestId: string,
	now = new Date(),
	deps?: CloseMailDeps
): Promise<{ ok: true; already?: boolean } | { ok: false; reason: 'not_found' | 'too_early' }> {
	if (!isUuid(requestId)) return { ok: false, reason: 'not_found' };
	const outcome = await db.transaction(async (tx) => {
		const [request] = await tx
			.select()
			.from(volunteerRequests)
			.where(eq(volunteerRequests.id, requestId))
			.for('update');
		if (!request) return { ok: false as const, reason: 'not_found' as const };
		if (request.closedAt) return { ok: true as const, already: true, letters: [] as Mail[] };
		if (request.respondBy > now) return { ok: false as const, reason: 'too_early' as const };
		if (request.status !== 'open') {
			await tx
				.update(volunteerRequests)
				.set({ closedAt: now })
				.where(eq(volunteerRequests.id, requestId));
			return { ok: true as const, letters: [] as Mail[] };
		}
		const invites = await tx
			.select()
			.from(volunteerInvitations)
			.where(eq(volunteerInvitations.requestId, requestId))
			.for('update');
		const accepted = invites.filter((i) => i.status === 'accepted').length;
		const full = accepted >= request.places;
		const letters: Mail[] = [];
		for (const invite of invites) {
			if (invite.status === 'invited') {
				const next = full ? ('excused' as const) : ('expired' as const);
				await tx
					.update(volunteerInvitations)
					.set({ status: next, countedAt: now })
					.where(eq(volunteerInvitations.id, invite.id));
				if (next === 'expired') {
					const letter = await bumpDeclineStreak(tx, invite.userId, 1, now, deps?.siteUrl);
					if (letter) letters.push(letter);
				}
			} else if (invite.status === 'declined' && invite.countedAt === null) {
				await tx
					.update(volunteerInvitations)
					.set({ countedAt: now })
					.where(eq(volunteerInvitations.id, invite.id));
				const letter = await bumpDeclineStreak(tx, invite.userId, 1, now, deps?.siteUrl);
				if (letter) letters.push(letter);
			}
		}
		await tx
			.update(volunteerRequests)
			.set({ closedAt: now })
			.where(eq(volunteerRequests.id, requestId));
		return { ok: true as const, letters };
	});
	if (!outcome.ok) return outcome;
	await sendLetters(deps, outcome.letters);
	return outcome.already ? { ok: true, already: true } : { ok: true };
}

export async function closeDueRequests(
	db: LimitDb,
	now = new Date(),
	deps?: CloseMailDeps
): Promise<{ closed: number; failed: number }> {
	const due = await db
		.select({ id: volunteerRequests.id })
		.from(volunteerRequests)
		.where(
			and(
				eq(volunteerRequests.status, 'open'),
				isNull(volunteerRequests.closedAt),
				lt(volunteerRequests.respondBy, now)
			)
		);
	let closed = 0;
	let failed = 0;
	for (const row of due) {
		try {
			const result = await closeRequestInvites(db, row.id, now, deps);
			if (result.ok && !result.already) closed += 1;
			else if (!result.ok) failed += 1;
		} catch (e) {
			failed += 1;
			console.error('volunteer closeDueRequests', row.id, e);
		}
	}
	return { closed, failed };
}
