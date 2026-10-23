import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { events } from '../../../db/schema/events';
import { eventRegistrations } from '../../../db/schema/registrations';
import { insertUser, testDb, testDbUrl } from '../../../db/test-db';
import { auditFor } from '../../memberships/test-support';
import { insertEvent, insertMember, registerOk as register, registrationOf } from '../test-support';
import { saveResults } from './results';

/* docs/05 section 5 "Results": place and score for each participant who came, the whole table at
 * once; a row that is not "attended" (or not of this event) refuses the save. */

const IP = '198.51.100.7';
type Tx = Parameters<typeof insertUser>[0];
const staff = async (tx: Tx, role: 'moderator' | 'admin' | 'editor' = 'moderator') => ({
	id: (await insertUser(tx, { role })).id,
	role
});

async function participant(tx: Tx, eventId: string, status: 'attended' | 'registered' = 'attended') {
	const { id } = await register(tx, (await insertMember(tx)).id, eventId);
	await tx
		.update(eventRegistrations)
		.set({ status, attendedAt: status === 'attended' ? new Date() : null })
		.where(eq(eventRegistrations.id, id));
	return id;
}

const row = (registrationId: string, place = '', score = '') => ({ registrationId, place, score });

describe.skipIf(!testDbUrl)('registrations staff: results', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('places and scores saved; one log entry per changed row; ties allowed', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx);
			const [a, b, c] = [
				await participant(tx, event.id),
				await participant(tx, event.id),
				await participant(tx, event.id)
			];
			const moderator = await staff(tx);
			const rows = [row(a, '1', '9.5'), row(b, '1', '8,25'), row(c)];

			expect(await saveResults(tx, moderator, { eventId: event.id, rows }, IP)).toBe('ok');
			expect(await registrationOf(tx, a)).toMatchObject({ place: 1, score: '9.50' });
			expect(await registrationOf(tx, b)).toMatchObject({ place: 1, score: '8.25' });
			expect(await registrationOf(tx, c)).toMatchObject({ place: null, score: null });
			expect(await auditFor(tx, 'registration', a)).toMatchObject([
				{
					action: 'registration.result',
					actorId: moderator.id,
					before: { place: null, score: null },
					after: { place: 1, score: '9.50', eventId: event.id }
				}
			]);
			expect(await auditFor(tx, 'registration', c)).toEqual([]);

			const again = [row(a, '2', '9.50'), row(b, '1', '8.25')];
			expect(await saveResults(tx, moderator, { eventId: event.id, rows: again }, IP)).toBe('ok');
			expect(await registrationOf(tx, a)).toMatchObject({ place: 2, score: '9.50' });
			expect(await auditFor(tx, 'registration', a)).toHaveLength(2);
			expect(await auditFor(tx, 'registration', b)).toHaveLength(1);
		});
	});

	it('a row not marked "came" or of another event: the whole save refused', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx);
			const came = await participant(tx, event.id);
			const notYet = await participant(tx, event.id, 'registered');
			const other = await participant(tx, (await insertEvent(tx)).id);
			const moderator = await staff(tx);
			for (const stranger of [notYet, other, crypto.randomUUID()]) {
				const rows = [row(came, '1'), row(stranger, '2')];
				expect(await saveResults(tx, moderator, { eventId: event.id, rows }, IP)).toBe(
					'wrong_status'
				);
			}
			expect((await registrationOf(tx, came)).place).toBeNull();
			expect(await auditFor(tx, 'registration', came)).toEqual([]);
		});
	});

	it('bad place or score, a closed event, an editor — refused', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx);
			const came = await participant(tx, event.id);
			const moderator = await staff(tx);
			const save = (rows: ReturnType<typeof row>[], actor = moderator, eventId = event.id) =>
				saveResults(tx, actor, { eventId, rows }, IP);

			for (const bad of [row(came, '0'), row(came, '1.5'), row(came, '', '-1'), row('x', '1')]) {
				expect(await save([bad]), JSON.stringify(bad)).toBe('invalid');
			}
			expect(await save([row(came, '1')], await staff(tx, 'editor'))).toBe('not_allowed');
			expect(await save([row(came, '1')], moderator, crypto.randomUUID())).toBe('not_found');
			for (const status of ['draft', 'cancelled', 'archived'] as const) {
				await tx.update(events).set({ status }).where(eq(events.id, event.id));
				expect(await save([row(came, '1')]), status).toBe('event_closed');
			}
			await tx.update(events).set({ status: 'finished' }).where(eq(events.id, event.id));
			expect(await save([row(came, '3')])).toBe('ok');
			expect((await registrationOf(tx, came)).place).toBe(3);
		});
	});
});
