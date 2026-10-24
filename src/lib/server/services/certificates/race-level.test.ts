import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { testDbUrl } from '../../db/test-db';
import { raceDb } from '../registrations/race-support';
import type { IssueCertificateInput } from './issue';
import { revokeCertificate } from './revoke';
import { IP, certsOf, issuer, levelOf, passedExam } from './test-support';

/* docs/03 sections 3.1, 3.4, roadmap 6.10: two level certificates issued at the same moment. The
 * member row is locked, so the second one is judged by the level the first one left: no level is
 * skipped and none is lowered, in either order. These tests commit (registrations/race-support.ts). */

type Issue = (tx: LimitDb) => Promise<unknown>;
const outcome = (r: unknown) => {
	const x = r as { ok: boolean; reason?: string };
	return x.ok ? 'ok' : x.reason;
};

describe.skipIf(!testDbUrl)('certificates: levels under simultaneous issues', () => {
	const db = raceDb();
	afterAll(db.cleanup);

	async function setup(level: 'novice' | 'advanced') {
		const member = await db.member({ level: 'novice' });
		const [a, b] = [await db.staff('admin'), await db.staff('admin')];
		const at = (to: 'advanced' | 'pro', extra: Partial<IssueCertificateInput>): Issue => {
			const input = { userId: member.id, kind: 'level' as const, level: to, ...extra };
			return (tx) => issuer(tx)(to === 'pro' ? b : a, input);
		};
		if (level === 'advanced') {
			const first = await issuer(db.main)(a, {
				userId: member.id,
				kind: 'level',
				level: 'advanced',
				comment: 'Transfer of 2019 records'
			});
			if (!first.ok) throw new Error(first.reason);
			const revoke = { certificateId: first.id, reason: 'Typo in the name' };
			expect(await revokeCertificate(db.main, a, revoke, IP)).toBe('ok');
		}
		return { member, at };
	}
	const kinds = async (userId: string) =>
		(await certsOf(db.main, userId))
			.filter((c) => c.status === 'active')
			.map((c) => c.level)
			.sort();

	it('a novice with passed "advanced" and "pro": the step first — both; "pro" first — refused', async () => {
		for (const stepFirst of [true, false]) {
			const { member, at } = await setup('novice');
			const advanced = at('advanced', { examId: (await passedExam(db.main, member.id)).id });
			const pro = at('pro', { examId: (await passedExam(db.main, member.id, 'level_pro')).id });

			const results = stepFirst ? await db.race(advanced, pro) : await db.race(pro, advanced);
			expect(results.map(outcome)).toEqual(stepFirst ? ['ok', 'ok'] : ['level_skip', 'ok']);
			expect(await levelOf(db.main, member.id)).toBe(stepFirst ? 'pro' : 'advanced');
			expect(await kinds(member.id)).toEqual(stepFirst ? ['advanced', 'pro'] : ['advanced']);
		}
	});

	it('"advanced" re-issued after a revoke while "pro" is issued: the level ends at "pro"', async () => {
		for (const proFirst of [true, false]) {
			const { member, at } = await setup('advanced');
			const again = at('advanced', { comment: 'Name corrected' });
			const pro = at('pro', { examId: (await passedExam(db.main, member.id, 'level_pro')).id });

			const results = proFirst ? await db.race(pro, again) : await db.race(again, pro);
			expect(results.map(outcome)).toEqual(proFirst ? ['ok', 'level_below'] : ['ok', 'ok']);
			expect(await levelOf(db.main, member.id)).toBe('pro');
			expect(await kinds(member.id)).toEqual(proFirst ? ['pro'] : ['advanced', 'pro']);
		}
	});
});
