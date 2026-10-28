import { afterAll, describe, expect, it } from 'vitest';
import { testDbUrl } from '../../db/test-db';
import { reviewPractice } from './practice-review';
import { submitPractice } from './practice-submit';
import { insertSubmission, submissionRow, YT } from './practice-test-support';
import { portalRaceDb } from './race-support';
import { IP, mailbox, SITE } from './test-support';

/* docs/todo.md 9.14: the reviewer decides the link shown on the card. The member's replacement and
 * the decision lock the request row first, so one waits for the other: an unseen link is never
 * accepted. These tests commit (race-support.ts). */

const shown = { action: 'approve' as const, comment: '', url: YT(1) };
const deps = () => ({ send: mailbox().send, siteUrl: SITE, ip: IP });

describe.skipIf(!testDbUrl)('training practice: the link replaced while the card is open', () => {
	const db = portalRaceDb();
	afterAll(db.cleanup);

	it('replaced first: the decision on the shown link is refused, the new link waits', async () => {
		const { course, member, tasks } = await db.practice();
		const moderator = await db.staff('moderator');
		const id = await insertSubmission(db.main, tasks[0], member.id, { url: YT(1) });
		const [sent, decided] = await db.race(
			(tx) => submitPractice(tx, member, course.slug, tasks[0], YT(2)),
			(tx) => reviewPractice(tx, moderator, id, shown, deps())
		);
		expect(sent).toEqual({ ok: true, replaced: true });
		expect(decided).toEqual({ ok: false, reason: 'changed' });
		expect(await submissionRow(db.main, id)).toMatchObject({ status: 'pending', url: YT(2) });
	});

	it('accepted first: the shown link stays accepted, the replacement is refused', async () => {
		const { course, member, tasks } = await db.practice();
		const moderator = await db.staff('moderator');
		const id = await insertSubmission(db.main, tasks[0], member.id, { url: YT(1) });
		const [decided, sent] = await db.race(
			(tx) => reviewPractice(tx, moderator, id, shown, deps()),
			(tx) => submitPractice(tx, member, course.slug, tasks[0], YT(2))
		);
		expect(decided).toEqual({ ok: true });
		expect(sent).toEqual({ ok: false, reason: 'bad_state' });
		expect(await submissionRow(db.main, id)).toMatchObject({ status: 'approved', url: YT(1) });
	});
});
