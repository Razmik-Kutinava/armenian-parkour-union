import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { events } from '../../db/schema/events';
import { pointsLedger, pointsRules } from '../../db/schema/points';
import { testDbUrl } from '../../db/test-db';
import { auditFor } from '../memberships/test-support';
import { balanceOf, ledgerSum } from '../points/test-support';
import { raceDb } from './race-support';
import { markAttendance } from './staff/attendance';
import { saveResults } from './staff/results';
import { registerOk } from './test-support';

/* docs/03 sections 6.2 p. 2, 7.6-7.7, roadmap 5.10: two staff phones tap at the same moment. The
 * event and registration rows are locked, so participation and the winner's points are paid once.
 * These tests commit (race-support.ts): rules are only added where missing (a fresh CI database has
 * none), never changed; the expected count follows the rule as it is. */

const IP = '198.51.100.7';
const RULES = ['event_participation', 'event_place_1'] as const;
type Reason = (typeof pointsLedger.$inferSelect)['reason'];

describe.skipIf(!testDbUrl)('registrations: points on simultaneous staff taps', () => {
	const db = raceDb();
	afterAll(db.cleanup);
	const paysOnce = new Map<string, number>();
	beforeAll(async () => {
		await db.main
			.insert(pointsRules)
			.values(RULES.map((code) => ({ code, title: { en: code }, points: 10 })))
			.onConflictDoNothing({ target: pointsRules.code });
		const rules = await db.main
			.select()
			.from(pointsRules)
			.where(inArray(pointsRules.code, [...RULES]));
		for (const r of rules) paysOnce.set(r.code, r.isActive && r.points > 0 ? 1 : 0);
	});

	/** Registered before the start; the event has started, so the marks are open. */
	async function started() {
		const event = await db.event();
		const member = await db.member();
		const { id } = await registerOk(db.main, member.id, event.id);
		await db.main
			.update(events)
			.set({ startsAt: new Date(Date.now() - 3_600_000) })
			.where(eq(events.id, event.id));
		return { event, member, ref: { eventId: event.id, registrationId: id } };
	}

	const entries = async (registrationId: string, reason: Reason) =>
		(
			await db.main
				.select({ id: pointsLedger.id })
				.from(pointsLedger)
				.where(and(eq(pointsLedger.sourceId, registrationId), eq(pointsLedger.reason, reason)))
		).length;
	const logged = async (registrationId: string, action: string) =>
		(await auditFor(db.main, 'registration', registrationId)).filter((e) => e.action === action)
			.length;

	it('"came" from two phones at once: attended once, participation paid once, one log entry', async () => {
		const { member, ref } = await started();
		const [a, b] = [await db.staff(), await db.staff()];
		const results = await db.race(
			(tx) => markAttendance(tx, a, { ...ref, came: true }, IP),
			(tx) => markAttendance(tx, b, { ...ref, came: true }, IP)
		);
		expect(results).toEqual(['ok', 'ok']);
		expect(await entries(ref.registrationId, 'event_participation')).toBe(
			paysOnce.get('event_participation')
		);
		expect(await logged(ref.registrationId, 'registration.attendance')).toBe(1);
		expect(await balanceOf(db.main, member.id)).toBe(await ledgerSum(db.main, member.id));
	});

	it("place 1 saved from two screens at once: the winner's points once", async () => {
		const { event, member, ref } = await started();
		const staff = await db.staff();
		expect(await markAttendance(db.main, staff, { ...ref, came: true }, IP)).toBe('ok');
		const rows = [{ registrationId: ref.registrationId, place: '1', score: '' }];
		const save = (tx: Parameters<typeof saveResults>[0]) =>
			saveResults(tx, staff, { eventId: event.id, rows }, IP);
		expect(await db.race(save, save)).toEqual(['ok', 'ok']);
		expect(await entries(ref.registrationId, 'event_place')).toBe(paysOnce.get('event_place_1'));
		expect(await entries(ref.registrationId, 'event_participation')).toBe(
			paysOnce.get('event_participation')
		);
		expect(await logged(ref.registrationId, 'registration.result')).toBe(1);
		expect(await balanceOf(db.main, member.id)).toBe(await ledgerSum(db.main, member.id));
	});
});
