import { afterAll, describe, expect, it } from 'vitest';
import { readListState } from '#lib/components/admin/list-state.ts';
import type { LimitDb } from '../auth/rate-limit';
import { auditLog } from '../db/schema/service';
import { insertUser, testDb, testDbUrl } from '../db/test-db';
import { auditFilterOptions, auditListOptions, getAuditEntry, listAudit } from './audit';

const state = (query: string) => readListState(new URLSearchParams(query), auditListOptions);

describe.skipIf(!testDbUrl)('audit log list (docs/05 section 22)', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	/** Entries with a unique action prefix, so rows already in the database stay out. */
	async function seed(tx: LimitDb) {
		const tag = crypto.randomUUID().slice(0, 8);
		const actor = await insertUser(tx, { name: `Auditor ${tag}` });
		const other = await insertUser(tx, { name: `Other ${tag}` });
		const at = (iso: string) => new Date(iso);
		const rows = await tx
			.insert(auditLog)
			.values([
				{
					actorId: actor.id,
					action: `t${tag}.a`,
					entityType: `user`,
					entityId: other.id,
					before: { role: 'member' },
					after: { role: 'editor' },
					ip: '203.0.113.1',
					createdAt: at('2020-03-01T08:00:00Z')
				},
				{
					actorId: other.id,
					action: `t${tag}.b`,
					entityType: `site_settings`,
					createdAt: at('2020-03-05T08:00:00Z')
				},
				// 2020-03-09T21:00Z is already 2020-03-10 01:00 in Yerevan (UTC+4)
				{
					actorId: actor.id,
					action: `t${tag}.a`,
					entityType: `user`,
					createdAt: at('2020-03-09T21:00:00Z')
				}
			])
			.returning({ id: auditLog.id });
		return { tag, actor, other, ids: rows.map((r) => r.id) };
	}

	it('newest first, with actor name, action, object and IP', async () => {
		await inRollback(async (tx) => {
			const s = await seed(tx);
			const { rows, total } = await listAudit(tx, state(`action=t${s.tag}.a`));
			expect(total).toBe(2);
			expect(rows.map((r) => r.id)).toEqual([s.ids[2], s.ids[0]]);
			expect(rows[1]).toMatchObject({
				actorName: `Auditor ${s.tag}`,
				entityType: 'user',
				entityId: s.other.id,
				ip: '203.0.113.1'
			});
			expect(rows[0].ip).toBeNull();
		});
	});

	it('filters: actor by name or email, object type', async () => {
		await inRollback(async (tx) => {
			const s = await seed(tx);
			const byName = await listAudit(tx, state(`q=Auditor ${s.tag}`));
			expect(byName.rows.map((r) => r.id)).toEqual([s.ids[2], s.ids[0]]);
			const byEmail = await listAudit(tx, state(`q=${s.other.email}`));
			expect(byEmail.rows.map((r) => r.id)).toEqual([s.ids[1]]);
			const settings = await listAudit(tx, state(`q=${s.tag}&entity=site_settings`));
			expect(settings.rows.map((r) => r.id)).toEqual([s.ids[1]]);
		});
	});

	it('period in Yerevan days, both ends included', async () => {
		await inRollback(async (tx) => {
			const s = await seed(tx);
			const ids = async (q: string) =>
				(await listAudit(tx, state(`q=${s.tag}&${q}`))).rows.map((r) => r.id).sort();
			expect(await ids('from=2020-03-05&to=2020-03-09')).toEqual([s.ids[1]]);
			expect(await ids('from=2020-03-10')).toEqual([s.ids[2]]);
			expect(await ids('to=2020-03-01')).toEqual([s.ids[0]]);
		});
	});

	it('malformed filter values are ignored, not sent to SQL', async () => {
		await inRollback(async (tx) => {
			const s = await seed(tx);
			const { total } = await listAudit(
				tx,
				state(`action=t${s.tag}.a&from=2020-13-45&entity=x' or 1=1`)
			);
			expect(total).toBe(2);
		});
	});

	it('filter options list existing actions and object types', async () => {
		await inRollback(async (tx) => {
			const s = await seed(tx);
			const { actions, entities } = await auditFilterOptions(tx);
			expect(actions).toEqual(expect.arrayContaining([`t${s.tag}.a`, `t${s.tag}.b`]));
			expect(entities).toEqual(expect.arrayContaining(['user', 'site_settings']));
		});
	});

	it('one entry with before and after; unknown id → null', async () => {
		await inRollback(async (tx) => {
			const s = await seed(tx);
			const entry = await getAuditEntry(tx, s.ids[0]);
			expect(entry).toMatchObject({
				before: { role: 'member' },
				after: { role: 'editor' },
				actorName: `Auditor ${s.tag}`
			});
			expect(await getAuditEntry(tx, crypto.randomUUID())).toBeNull();
			expect(await getAuditEntry(tx, 'nope')).toBeNull();
		});
	});
});
