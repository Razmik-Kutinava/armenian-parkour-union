import { and, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import {
	volunteerInvitations,
	volunteerReports,
	volunteerRequests
} from '../../db/schema/volunteer-requests';
import { testDb, testDbUrl } from '../../db/test-db';
import { fakeStorage } from '../media/fake-storage';
import { applyForCard } from './card-apply';
import { decideCard } from './card-decision';
import { answerInvite } from './invite-answer';
import { closeRequestInvites } from './invite-close';
import { markInvite } from './invite-mark';
import { createRequest, publishRequest, type RequestValues } from './requests-admin';
import { signReportUpload, submitReport } from './report-submit';
import { writeVolunteerSettings } from './settings';
import { cardDeps as deps, daysFromNow, IP, mailbox, staff, volunteer } from './test-support';

/* docs/03 section 19.7 p. 2; docs/06 section 5.12; decisions — docs/todo.md 10.10 (1–3, 6). */

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
const LINK = 'https://youtu.be/ppppppppppA';
const STORED = 'https://www.youtube.com/watch?v=ppppppppppA';
const refused = (reason: string) => ({ ok: false, reason });

const values = (extra: Partial<RequestValues> = {}): RequestValues => ({
	title: { en: `Report ${crypto.randomUUID().slice(0, 8)}` },
	description: null,
	eventId: null,
	startsAt: daysFromNow(0.01),
	endsAt: daysFromNow(0.2),
	location: null,
	places: 2,
	respondBy: daysFromNow(-0.5),
	...extra
});

async function attendedInvite(tx: LimitDb) {
	await writeVolunteerSettings(tx, { declineThreshold: 99, cashierInviteHours: 72 });
	const admin = await staff(tx);
	const user = await volunteer(tx);
	const applied = await applyForCard(tx, user.id, deps(mailbox().send));
	if (!applied.ok) throw new Error(applied.reason);
	await decideCard(tx, admin, applied.id, { action: 'issue' }, deps(mailbox().send));
	const created = await createRequest(
		tx,
		admin,
		values({
			places: 5,
			startsAt: daysFromNow(-0.1),
			endsAt: daysFromNow(0.1),
			respondBy: daysFromNow(-0.2)
		}),
		IP
	);
	if (typeof created === 'string') throw new Error(created);
	await tx
		.update(volunteerRequests)
		.set({
			respondBy: daysFromNow(1),
			startsAt: daysFromNow(2),
			endsAt: daysFromNow(2.1)
		})
		.where(eq(volunteerRequests.id, created.id));
	await publishRequest(tx, admin, created.id, deps(mailbox().send));
	/* Publish invites every valid card already in the database — pick ours. */
	const [mine] = await tx
		.select()
		.from(volunteerInvitations)
		.where(
			and(eq(volunteerInvitations.requestId, created.id), eq(volunteerInvitations.userId, user.id))
		);
	if (!mine) throw new Error('no invite');
	const answered = await answerInvite(tx, user.id, mine.id, 'accepted');
	if (!answered.ok) throw new Error(answered.reason);
	await tx
		.update(volunteerRequests)
		.set({
			respondBy: daysFromNow(-0.2),
			startsAt: daysFromNow(-0.1),
			endsAt: daysFromNow(0.1)
		})
		.where(eq(volunteerRequests.id, created.id));
	await closeRequestInvites(tx, created.id, daysFromNow(0));
	expect(await markInvite(tx, admin, mine.id, 'attended', IP)).toBe('ok');
	return { admin, user, inviteId: mine.id, requestId: created.id };
}

const rowsOf = (tx: LimitDb, invitationId: string) =>
	tx
		.select()
		.from(volunteerReports)
		.where(eq(volunteerReports.invitationId, invitationId))
		.orderBy(volunteerReports.createdAt);

describe.skipIf(!testDbUrl)('volunteer report: the member sends', { timeout: 60_000 }, () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('after attended: a pending report with the normalized link', async () => {
		await inRollback(async (tx) => {
			const { user, inviteId } = await attendedInvite(tx);
			const result = await submitReport(tx, user.id, { invitationId: inviteId, url: LINK });
			expect(result).toEqual({ ok: true, id: expect.any(String), replaced: false });
			const [row] = await rowsOf(tx, inviteId);
			expect(row).toMatchObject({
				userId: user.id,
				url: STORED,
				fileKey: null,
				status: 'pending',
				reviewedAt: null
			});
		});
	});

	it('while pending replaces; after approval — refused; after reject — a new row', async () => {
		await inRollback(async (tx) => {
			const { user, inviteId } = await attendedInvite(tx);
			await submitReport(tx, user.id, { invitationId: inviteId, url: LINK });
			const drive = 'https://drive.google.com/open?id=1AbCdEfGhIjKlMnOp';
			const again = await submitReport(tx, user.id, {
				invitationId: inviteId,
				url: drive,
				note: ' Better shot '
			});
			expect(again).toEqual({ ok: true, id: expect.any(String), replaced: true });
			expect(await rowsOf(tx, inviteId)).toHaveLength(1);
			expect((await rowsOf(tx, inviteId))[0]).toMatchObject({
				url: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view',
				note: 'Better shot'
			});
			await tx
				.update(volunteerReports)
				.set({ status: 'approved', reviewedAt: new Date(), reviewedBy: user.id })
				.where(eq(volunteerReports.invitationId, inviteId));
			expect(await submitReport(tx, user.id, { invitationId: inviteId, url: LINK })).toEqual(
				refused('bad_state')
			);
			await tx
				.update(volunteerReports)
				.set({ status: 'rejected', reviewNote: 'Blurry', reviewedAt: new Date() })
				.where(eq(volunteerReports.invitationId, inviteId));
			expect(await submitReport(tx, user.id, { invitationId: inviteId, url: LINK })).toEqual({
				ok: true,
				id: expect.any(String),
				replaced: false
			});
			expect((await rowsOf(tx, inviteId)).map((r) => r.status).sort()).toEqual([
				'pending',
				'rejected'
			]);
		});
	});

	it('photo via private bucket; not attended / bad url / foreign invite — refused', async () => {
		await inRollback(async (tx) => {
			const { user, inviteId, admin } = await attendedInvite(tx);
			const storage = fakeStorage();
			const signed = await signReportUpload(tx, storage, user.id, {
				mime: 'image/png',
				size: PNG.length
			});
			if (typeof signed === 'string') throw new Error(signed);
			expect(signed.key).toMatch(new RegExp(`^volunteer/${user.id}/[0-9a-f-]+\\.png$`));
			storage.objects.set(signed.key, PNG);
			expect(
				await submitReport(tx, user.id, { invitationId: inviteId, key: signed.key }, storage)
			).toEqual({ ok: true, id: expect.any(String), replaced: false });
			expect((await rowsOf(tx, inviteId))[0]).toMatchObject({
				fileKey: signed.key,
				url: null,
				status: 'pending'
			});

			const other = await attendedInvite(tx);
			expect(await submitReport(tx, user.id, { invitationId: other.inviteId, url: LINK })).toEqual(
				refused('not_found')
			);
			expect(
				await submitReport(tx, user.id, { invitationId: inviteId, url: 'https://vimeo.com/1' })
			).toEqual(refused('bad_url'));
			await tx
				.update(volunteerInvitations)
				.set({ status: 'accepted' })
				.where(eq(volunteerInvitations.id, inviteId));
			/* Mark as accepted again so attendance gate fails after we cleared it. */
			await markInvite(tx, admin, inviteId, 'no_show', IP);
			expect(await submitReport(tx, user.id, { invitationId: inviteId, url: LINK })).toEqual(
				refused('not_attended')
			);
		});
	});
});
