import { afterAll, describe, expect, it } from 'vitest';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { insertEvent, insertMember } from '../registrations/test-support';
import { examEventOptions, examinerOptions, examMember, getExamCard } from './card';
import { daysFrom, insertExam, insertStaff } from './test-support';

/* docs/05 section 7: the exam card, the examiner list (moderator and admin, docs/04 section 2),
 * the optional event, the chosen member — name, level, status; no contacts (docs/04 section 4). */

const NOW = new Date();

describe.skipIf(!testDbUrl)('exams: card and form choices', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('card: member, kind, date, event, examiner, notes, result; unknown or bad id → null', async () => {
		await inRollback(async (tx) => {
			const member = await insertMember(tx, { level: 'novice' });
			const examiner = await insertUser(tx, { role: 'moderator', name: 'Examiner Bo' });
			const event = await insertEvent(tx, { title: { en: 'Exam day', ru: 'День экзамена' } });
			const exam = await insertExam(tx, {
				userId: member.id,
				kind: 'level_advanced',
				eventId: event.id,
				examinerId: examiner.id,
				notes: 'Bring shoes',
				scheduledAt: daysFrom(NOW, 3)
			});
			const card = await getExamCard(tx, exam.id);
			expect(card).toMatchObject({
				id: exam.id,
				userId: member.id,
				memberName: `Test ${member.tag}`,
				memberLevel: 'novice',
				kind: 'level_advanced',
				scheduledAt: exam.scheduledAt,
				eventId: event.id,
				eventTitle: { en: 'Exam day', ru: 'День экзамена' },
				examinerName: 'Examiner Bo',
				notes: 'Bring shoes',
				result: 'scheduled',
				score: null,
				decidedAt: null
			});
			expect(JSON.stringify(card)).not.toContain(member.email);
			expect(await getExamCard(tx, crypto.randomUUID())).toBeNull();
			expect(await getExamCard(tx, 'not-a-uuid')).toBeNull();
		});
	});

	it('examiners: active moderators and admins only, by name', async () => {
		await inRollback(async (tx) => {
			const tag = crypto.randomUUID();
			const mod = await insertUser(tx, { role: 'moderator', name: `B ${tag}` });
			const admin = await insertUser(tx, { role: 'admin', name: `A ${tag}` });
			await insertUser(tx, { role: 'moderator', name: `C ${tag}`, status: 'blocked' });
			await insertUser(tx, { role: 'moderator', name: `D ${tag}`, deletedAt: new Date() });
			await insertUser(tx, { role: 'editor', name: `E ${tag}` });
			await insertUser(tx, { name: `F ${tag}` });
			const mine = (await examinerOptions(tx)).filter((o) => o.name.endsWith(tag));
			expect(mine).toEqual([
				{ id: admin.id, name: `A ${tag}` },
				{ id: mod.id, name: `B ${tag}` }
			]);
		});
	});

	it('events: not deleted, from 90 days back to a year ahead', async () => {
		await inRollback(async (tx) => {
			const near = await insertEvent(tx, { startsAt: daysFrom(NOW, 20) });
			const recent = await insertEvent(tx, { startsAt: daysFrom(NOW, -30) });
			const old = await insertEvent(tx, { startsAt: daysFrom(NOW, -100) });
			const far = await insertEvent(tx, { startsAt: daysFrom(NOW, 400) });
			const gone = await insertEvent(tx, { startsAt: daysFrom(NOW, 10), deletedAt: NOW });
			const ids = (await examEventOptions(tx, NOW)).map((e) => e.id);
			expect(ids).toEqual(expect.arrayContaining([near.id, recent.id]));
			for (const id of [old.id, far.id, gone.id]) expect(ids).not.toContain(id);
			const option = (await examEventOptions(tx, NOW)).find((e) => e.id === near.id);
			expect(option).toEqual({ id: near.id, title: near.title, startsAt: near.startsAt });
		});
	});

	it('chosen member: name, level, status; a moderator reaches members only', async () => {
		await inRollback(async (tx) => {
			const member = await insertMember(tx, { level: 'advanced' });
			const staffUser = await insertUser(tx, { role: 'editor' });
			const gone = await insertUser(tx, { deletedAt: NOW });
			const moderator = await insertStaff(tx);
			const admin = await insertStaff(tx, 'admin');

			expect(await examMember(tx, moderator, member.id)).toEqual({
				id: member.id,
				name: `Test ${member.tag}`,
				level: 'advanced',
				status: 'active'
			});
			expect(await examMember(tx, moderator, staffUser.id)).toBeNull();
			expect(await examMember(tx, admin, staffUser.id)).not.toBeNull();
			expect(await examMember(tx, admin, gone.id)).toBeNull();
			expect(await examMember(tx, admin, 'nope')).toBeNull();
		});
	});
});
