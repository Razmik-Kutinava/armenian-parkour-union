import { afterAll, describe, expect, it } from 'vitest';
import { readListState } from '#lib/components/admin/list-state.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { listUsers, userListOptions } from './list';

const asAdmin = { id: crypto.randomUUID(), role: 'admin' as const };
const asMod = { id: crypto.randomUUID(), role: 'moderator' as const };
const TODAY = new Date('2026-10-07T12:00:00Z');

const state = (query: string) => readListState(new URLSearchParams(query), userListOptions);

describe.skipIf(!testDbUrl)('listUsers (docs/05 section 6, docs/04 sections 4 and 6.5)', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	/** Users that share one search tag in the last name, so other rows in the database stay out. */
	async function group(tx: LimitDb) {
		const tag = crypto.randomUUID();
		const add = (values: Parameters<typeof insertUser>[1]) =>
			insertUser(tx, { lastName: `${tag} ${values?.firstName ?? ''}`, ...values });
		return {
			tag,
			adult: await add({ firstName: 'Adult', city: 'Gyumri', phone: '+37491000001' }),
			minor: await add({ firstName: 'Minor', birthDate: '2015-05-05', level: 'novice' }),
			editor: await add({ firstName: 'Editor', role: 'editor' }),
			blocked: await add({ firstName: 'Blocked', status: 'blocked' }),
			deleted: await add({ firstName: 'Deleted', deletedAt: new Date() })
		};
	}
	const ids = (rows: { id: string }[]) => rows.map((r) => r.id).sort();

	it('admin sees everyone except deleted, with email', async () => {
		await inRollback(async (tx) => {
			const g = await group(tx);
			const { rows, total } = await listUsers(tx, asAdmin, state(`q=${g.tag}`), TODAY);
			expect(total).toBe(4);
			expect(ids(rows)).toEqual(ids([g.adult, g.minor, g.editor, g.blocked]));
			expect(rows.find((r) => r.id === g.adult.id)?.email).toBe(g.adult.email);
		});
	});

	it('moderator: only members, no email field, no search by email or phone', async () => {
		await inRollback(async (tx) => {
			const g = await group(tx);
			const { rows } = await listUsers(tx, asMod, state(`q=${g.tag}`), TODAY);
			expect(ids(rows)).toEqual(ids([g.adult, g.minor, g.blocked]));
			for (const row of rows) expect(row).not.toHaveProperty('email');
			const byEmail = await listUsers(tx, asMod, state(`q=${g.adult.email}`), TODAY);
			expect(byEmail.total).toBe(0);
			const byPhone = await listUsers(tx, asMod, state('q=%2B37491000001'), TODAY);
			expect(ids(byPhone.rows)).not.toContain(g.adult.id);
		});
	});

	it('admin searches by email and phone', async () => {
		await inRollback(async (tx) => {
			const g = await group(tx);
			const byEmail = await listUsers(tx, asAdmin, state(`q=${g.adult.email}`), TODAY);
			expect(ids(byEmail.rows)).toEqual([g.adult.id]);
			const byPhone = await listUsers(tx, asAdmin, state('q=%2B37491000001'), TODAY);
			expect(ids(byPhone.rows)).toContain(g.adult.id);
		});
	});

	it('filters: level, role, status, age group, city', async () => {
		await inRollback(async (tx) => {
			const g = await group(tx);
			const run = async (filter: string) =>
				ids((await listUsers(tx, asAdmin, state(`q=${g.tag}&${filter}`), TODAY)).rows);
			expect(await run('level=novice')).toEqual([g.minor.id]);
			expect(await run('role=editor')).toEqual([g.editor.id]);
			expect(await run('status=blocked')).toEqual([g.blocked.id]);
			expect(await run('age=minor')).toEqual([g.minor.id]);
			expect(await run('age=adult')).not.toContain(g.minor.id);
			expect(await run('city=gyumri')).toEqual([g.adult.id]);
		});
	});

	it('a filter value outside the list is ignored, not passed to the query', async () => {
		await inRollback(async (tx) => {
			const g = await group(tx);
			const { total } = await listUsers(tx, asAdmin, state(`q=${g.tag}&role=root`), TODAY);
			expect(total).toBe(4);
		});
	});

	it('pages by 25 and sorts by name', async () => {
		await inRollback(async (tx) => {
			const tag = crypto.randomUUID();
			for (let i = 0; i < 27; i++) {
				await insertUser(tx, { name: `N${String(i).padStart(2, '0')} ${tag}`, lastName: tag });
			}
			const first = await listUsers(tx, asAdmin, state(`q=${tag}&sort=name&dir=asc`), TODAY);
			expect(first.total).toBe(27);
			expect(first.rows).toHaveLength(25);
			expect(first.rows[0].name.startsWith('N00')).toBe(true);
			const second = await listUsers(tx, asAdmin, state(`q=${tag}&sort=name&page=2`), TODAY);
			expect(second.rows.map((r) => r.name.slice(0, 3))).toEqual(['N25', 'N26']);
		});
	});
});
