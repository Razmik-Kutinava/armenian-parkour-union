import { and, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import {
	volunteerInvitations,
	volunteerReports,
	volunteerRequests
} from '../../db/schema/volunteer-requests';
import { testDb, testDbUrl } from '../../db/test-db';
import { auditFor } from '../memberships/test-support';
import { balanceOf, setRules } from '../points/test-support';
import { applyForCard } from './card-apply';
import { decideCard } from './card-decision';
import { answerInvite } from './invite-answer';
import { closeRequestInvites } from './invite-close';
import { markInvite } from './invite-mark';
import { createRequest, publishRequest, type RequestValues } from './requests-admin';
import { reviewReport } from './report-review';
import { writeVolunteerSettings } from './settings';
import { cardDeps as deps, daysFromNow, IP, mailbox, SITE, staff, volunteer } from './test-support';

/* docs/03 section 19.7 p. 3, 19.9; docs/05 section 28 "Reports"; decisions — docs/todo.md 10.10 (4–5). */

const STORED = 'https://www.youtube.com/watch?v=ppppppppppA';
const refused = (reason: string) => ({ ok: false, reason });
const reviewDeps = (send = mailbox().send) => ({ send, siteUrl: SITE, ip: IP });

const values = (extra: Partial<RequestValues> = {}): RequestValues => ({
	title: { en: `Review ${crypto.randomUUID().slice(0, 8)}` },
	description: null,
	eventId: null,
	startsAt: daysFromNow(0.01),
	endsAt: daysFromNow(0.2),
	location: null,
	places: 5,
	respondBy: daysFromNow(-0.5),
	...extra
});

async function pendingReport(tx: LimitDb, locale: 'en' | 'ru' = 'en') {
	await writeVolunteerSettings(tx, { declineThreshold: 99, cashierInviteHours: 72 });
	await setRules(tx, { volunteer_participation: { points: 20 }, volunteer_report: { points: 10 } });
	const admin = await staff(tx);
	const user = await volunteer(tx, { locale });
	const applied = await applyForCard(tx, user.id, deps(mailbox().send));
	if (!applied.ok) throw new Error(applied.reason);
	await decideCard(tx, admin, applied.id, { action: 'issue' }, deps(mailbox().send));
	const created = await createRequest(
		tx,
		admin,
		values({
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
	const [row] = await tx
		.insert(volunteerReports)
		.values({ invitationId: mine.id, userId: user.id, url: STORED, status: 'pending' })
		.returning({ id: volunteerReports.id });
	return { admin, user, inviteId: mine.id, reportId: row.id };
}

describe.skipIf(!testDbUrl)('volunteer report: the review', { timeout: 60_000 }, () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('admin accepts: points once, audited, letter; second approve skips points', async () => {
		await inRollback(async (tx) => {
			const { admin, user, reportId } = await pendingReport(tx, 'ru');
			const before = await balanceOf(tx, user.id);
			const box = mailbox();
			expect(
				await reviewReport(
					tx,
					admin,
					reportId,
					{ action: 'approve', comment: '', shown: STORED },
					reviewDeps(box.send)
				)
			).toEqual({ ok: true });
			const [row] = await tx
				.select()
				.from(volunteerReports)
				.where(eq(volunteerReports.id, reportId));
			expect(row).toMatchObject({
				status: 'approved',
				reviewedBy: admin.id,
				reviewNote: null
			});
			expect(row.reviewedAt).toBeInstanceOf(Date);
			expect(await balanceOf(tx, user.id)).toBe(before + 10);
			const [entry] = await auditFor(tx, 'volunteer_report', reportId);
			expect(entry).toMatchObject({
				action: 'volunteer_report.approve',
				actorId: admin.id,
				ip: IP,
				before: { status: 'pending' },
				after: expect.objectContaining({ status: 'approved', points: 10, userId: user.id })
			});
			expect(box.sent).toHaveLength(1);
			expect(box.sent[0].subject).toMatch(/принят|accepted|фотоотчёт/i);
			expect(box.sent[0].text).toContain(`${SITE}/ru/cabinet/volunteer`);

			await tx
				.update(volunteerReports)
				.set({ status: 'pending', reviewedAt: null, reviewedBy: null })
				.where(eq(volunteerReports.id, reportId));
			const box2 = mailbox();
			await reviewReport(
				tx,
				admin,
				reportId,
				{ action: 'approve', comment: '', shown: STORED },
				reviewDeps(box2.send)
			);
			expect(await balanceOf(tx, user.id)).toBe(before + 10);
		});
	});

	it('return needs a comment; own report and changed shown — refused', async () => {
		await inRollback(async (tx) => {
			const { admin, user, reportId } = await pendingReport(tx);
			const box = mailbox();
			expect(
				await reviewReport(
					tx,
					admin,
					reportId,
					{ action: 'reject', comment: '   ', shown: STORED },
					reviewDeps(box.send)
				)
			).toEqual(refused('invalid'));
			expect(
				await reviewReport(
					tx,
					{ id: user.id, role: 'admin' },
					reportId,
					{ action: 'approve', comment: '', shown: STORED },
					reviewDeps(box.send)
				)
			).toEqual(refused('own'));
			expect(
				await reviewReport(
					tx,
					admin,
					reportId,
					{ action: 'approve', comment: '', shown: 'https://www.youtube.com/watch?v=other' },
					reviewDeps(box.send)
				)
			).toEqual(refused('changed'));
			expect(
				await reviewReport(
					tx,
					admin,
					reportId,
					{ action: 'reject', comment: ' Blurry ', shown: STORED },
					reviewDeps(box.send)
				)
			).toEqual({ ok: true });
			const [row] = await tx
				.select()
				.from(volunteerReports)
				.where(eq(volunteerReports.id, reportId));
			expect(row).toMatchObject({ status: 'rejected', reviewNote: 'Blurry' });
			expect(box.sent).toHaveLength(1);
			expect(box.sent[0].text).toContain('Blurry');
			expect(
				await reviewReport(
					tx,
					admin,
					reportId,
					{ action: 'approve', comment: '', shown: STORED },
					reviewDeps(mailbox().send)
				)
			).toEqual(refused('bad_state'));
		});
	});

	it('moderator and editor cannot review', async () => {
		await inRollback(async (tx) => {
			const { reportId } = await pendingReport(tx);
			for (const role of ['moderator', 'editor'] as const) {
				const actor = await staff(tx, role);
				expect(
					await reviewReport(
						tx,
						actor,
						reportId,
						{ action: 'approve', comment: '', shown: STORED },
						reviewDeps()
					)
				).toEqual(refused('not_allowed'));
			}
		});
	});
});
