import { afterAll, describe, expect, it } from 'vitest';
import { readListState } from '#lib/components/admin/list-state.ts';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { adjustPoints } from './adjust';
import { pointsCsv, pointsForExport } from './admin-export';
import { pointsListOptions } from './admin-list';
import { reverseEntry } from './reverse';
import { staffActor } from './test-support';

/* docs/05 section 12: CSV of the ledger with the filters of the list; no formulas in cells. */

const IP = { ip: null };
const state = (query: Record<string, string>) =>
	readListState(new URLSearchParams(query), pointsListOptions);

describe.skipIf(!testDbUrl)('admin points: CSV export', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('rows of the filter, with author and reversal links; a formula comment stays text', async () => {
		await inRollback(async (tx) => {
			const admin = await staffActor(tx);
			const member = await insertUser(tx);
			const other = await insertUser(tx);
			const add = await adjustPoints(
				tx,
				admin,
				{ userId: member.id, delta: 40, comment: '=HYPERLINK("http://evil")' },
				IP
			);
			if (!add.ok) throw new Error(add.reason);
			const back = await reverseEntry(tx, admin, { entryId: add.entryId, comment: 'Wrong' }, IP);
			if (!back.ok) throw new Error(back.reason);
			await adjustPoints(tx, admin, { userId: other.id, delta: 5, comment: 'Other' }, IP);

			const rows = await pointsForExport(tx, state({ q: member.tag }));
			expect(rows.map((r) => r.id).sort()).toEqual([add.entryId, back.entryId].sort());
			const [header, ...lines] = pointsCsv(rows).trim().split('\r\n');
			expect(header).toBe(
				'created_at,entry_id,user_id,user_name,user_email,delta,reason,source_type,source_id,comment,created_by,reversal_of,reversed_by'
			);
			expect(lines).toHaveLength(2);
			const original = lines.find((l) => l.includes(`,${add.entryId},`))!;
			expect(original).toContain(member.email);
			expect(original).toContain(',40,manual,');
			expect(original).toContain(`"'=HYPERLINK(""http://evil"")"`);
			expect(original.endsWith(`,${back.entryId}`)).toBe(true);
			const reversal = lines.find((l) => l.includes(`,${back.entryId},`))!;
			expect(reversal).toContain(',-40,reversal,');
			expect(reversal).toContain(`,${add.entryId},`);
		});
	});

	it('the cap limits the number of rows', async () => {
		await inRollback(async (tx) => {
			const admin = await staffActor(tx);
			const member = await insertUser(tx);
			for (const delta of [1, 2, 3]) {
				await adjustPoints(tx, admin, { userId: member.id, delta, comment: 'x' }, IP);
			}
			expect(await pointsForExport(tx, state({ q: member.tag }), 2)).toHaveLength(2);
		});
	});
});
