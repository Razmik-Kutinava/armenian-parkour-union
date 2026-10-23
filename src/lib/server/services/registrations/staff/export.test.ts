import { afterAll, describe, expect, it } from 'vitest';
import { readListState } from '#lib/components/admin/list-state.ts';
import { insertUser, testDb, testDbUrl } from '../../../db/test-db';
import { insertCategory, insertEvent, insertMember, registerOk as register } from '../test-support';
import { registrationsCsv, registrationsForExport } from './export';
import { registrationListOptions } from './list';

/* docs/05 section 5: CSV of the event registrations with the filters of the list; the email column
 * only for a viewer who may see it (docs/04 section 4); no formulas in cells. */

type Tx = Parameters<typeof insertUser>[0];
const staff = async (tx: Tx, role: 'moderator' | 'admin') => ({
	id: (await insertUser(tx, { role })).id,
	role
});
const state = (query: Record<string, string> = {}) =>
	readListState(new URLSearchParams(query), registrationListOptions);

describe.skipIf(!testDbUrl)('registrations staff: CSV export', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('admin: with the email; the category in the staff language; a formula stays text', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx);
			const category = await insertCategory(tx, event.id, {
				name: { en: 'Speed', ru: 'Скорость' }
			});
			const member = await insertMember(tx, { name: '=HYPERLINK("http://evil")' });
			const { id } = await register(tx, member.id, event.id, category.id);

			const admin = await staff(tx, 'admin');
			const rows = await registrationsForExport(tx, admin, event.id, state());
			const [header, line, ...rest] = registrationsCsv(rows, 'ru', true).trim().split('\r\n');
			expect(header).toBe(
				'registration_id,user_id,name,email,age,category,status,paid,registered_at,attended_at,place,score,result_note'
			);
			expect(rest).toEqual([]);
			expect(line.startsWith(`${id},${member.id},"'=HYPERLINK(""http://evil"")",`)).toBe(true);
			expect(line).toContain(`,${member.email},`);
			expect(line).toContain(',Скорость,registered,');
		});
	});

	it('moderator: no email column and no email anywhere; filters apply', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx, { capacity: 1 });
			const member = await insertMember(tx);
			await register(tx, member.id, event.id);
			await register(tx, (await insertMember(tx)).id, event.id);

			const moderator = await staff(tx, 'moderator');
			const rows = await registrationsForExport(
				tx,
				moderator,
				event.id,
				state({ status: 'registered' })
			);
			const csv = registrationsCsv(rows, 'en', false);
			const [header, ...lines] = csv.trim().split('\r\n');
			expect(header.split(',')).not.toContain('email');
			expect(lines).toHaveLength(1);
			expect(csv).not.toContain(member.email);
			expect(await registrationsForExport(tx, moderator, event.id, state(), 0)).toEqual([]);
		});
	});
});
