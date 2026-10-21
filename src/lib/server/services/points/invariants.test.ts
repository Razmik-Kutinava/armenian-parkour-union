import { afterAll, describe, expect, it } from 'vitest';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { adjustPoints } from './adjust';
import { awardPoints, type PointsRuleCode } from './award';
import { reverseEntry } from './reverse';
import { balanceOf, ledgerOf, setRules, staffActor } from './test-support';

/* Roadmap 4.6, docs/03 section 6: whatever goes through the service — awards, repeats, manual
 * operations, reversals, refusals — the balance never goes below zero and always equals the sum
 * of the member's ledger. */

const IP = { ip: '10.0.0.7' };
const duplicate = { status: 'skipped', reason: 'duplicate' };
const refused = (reason: string) => ({ ok: false, reason });

describe.skipIf(!testDbUrl)('points: balance equals the ledger sum after every operation', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it(
		'a mixed history through all entry points, refusals included',
		{ timeout: 60_000 },
		async () => {
			await inRollback(async (tx) => {
				await setRules(tx, {
					certificate_level_advanced: { points: 100 },
					video_approved: { points: 10 },
					event_registration: { points: 5 }
				});
				const admin = await staffActor(tx);
				const { id: userId } = await insertUser(tx);
				let entries = 0;
				const written = {};

				/** `written` — a new entry is expected; otherwise the exact refusal and nothing written. */
				async function step(label: string, op: Promise<object>, balance: number, outcome: object) {
					const result = (await op) as { entryId?: string };
					if (outcome === written) {
						expect(result.entryId, label).toBeTypeOf('string');
						entries++;
					} else expect(result, label).toEqual(outcome);
					const ledger = await ledgerOf(tx, userId);
					expect(ledger, label).toHaveLength(entries);
					expect(
						ledger.reduce((sum, e) => sum + e.delta, 0),
						label
					).toBe(balance);
					expect(await balanceOf(tx, userId), label).toBe(balance);
					return result.entryId ?? '';
				}
				const award = (rule: PointsRuleCode, sourceId: string) =>
					awardPoints(tx, { rule, userId, sourceId });
				const adjust = (delta: number) =>
					adjustPoints(tx, admin, { userId, delta, comment: `adjust ${delta}` }, IP);
				const reverse = (entryId: string) =>
					reverseEntry(tx, admin, { entryId, comment: 'reverse' }, IP);

				const cert = crypto.randomUUID();
				const video = crypto.randomUUID();
				const certEntry = await step(
					'certificate',
					award('certificate_level_advanced', cert),
					100,
					written
				);
				await step('same certificate', award('certificate_level_advanced', cert), 100, duplicate);
				await step('video', award('video_approved', video), 110, written);
				await step('same video', award('video_approved', video), 110, duplicate);
				await step('manual +40', adjust(40), 150, written);
				await step('manual -200', adjust(-200), 150, refused('insufficient_balance'));
				const charge = await step('manual -150', adjust(-150), 0, written);
				await step('registration', award('event_registration', crypto.randomUUID()), 5, written);
				await step('reversal below zero', reverse(certEntry), 5, refused('insufficient_balance'));
				await step('manual +100', adjust(100), 105, written);
				const reversal = await step('reverse certificate', reverse(certEntry), 5, written);
				await step('reverse it again', reverse(certEntry), 5, refused('already_reversed'));
				await step('reverse the reversal', reverse(reversal), 5, refused('not_reversible'));
				await step('reverse the -150 charge', reverse(charge), 155, written);
			});
		}
	);
});
