import { afterAll, describe, expect, it } from 'vitest';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { getUserCard } from './card';

const asAdmin = { id: crypto.randomUUID(), role: 'admin' as const };
const asMod = { id: crypto.randomUUID(), role: 'moderator' as const };
const TODAY = new Date('2026-10-07T12:00:00Z');

describe.skipIf(!testDbUrl)('getUserCard (docs/04 section 4)', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	const minorValues = {
		birthDate: '2012-10-08',
		phone: '+37491000002',
		city: 'Yerevan',
		guardianName: 'Parent',
		guardianPhone: '+37491000003',
		guardianEmail: 'parent@example.com'
	};

	it('admin sees contacts and the birth date', async () => {
		await inRollback(async (tx) => {
			const u = await insertUser(tx, minorValues);
			const card = await getUserCard(tx, asAdmin, u.id, TODAY);
			expect(card).toMatchObject({
				email: u.email,
				phone: '+37491000002',
				birthDate: '2012-10-08',
				age: 13,
				guardianEmail: 'parent@example.com'
			});
		});
	});

	it('moderator gets age only, no email, phone or birth date; parent data stays', async () => {
		await inRollback(async (tx) => {
			const u = await insertUser(tx, minorValues);
			const card = await getUserCard(tx, asMod, u.id, TODAY);
			expect(card).not.toBeNull();
			for (const field of ['email', 'phone', 'birthDate']) expect(card).not.toHaveProperty(field);
			expect(card).toMatchObject({ age: 13, city: 'Yerevan', guardianPhone: '+37491000003' });
		});
	});

	it('moderator cannot open staff accounts (404)', async () => {
		await inRollback(async (tx) => {
			for (const role of ['editor', 'moderator', 'admin'] as const) {
				const u = await insertUser(tx, { role });
				expect(await getUserCard(tx, asMod, u.id, TODAY)).toBeNull();
			}
		});
	});

	it('unknown, malformed or deleted id → null', async () => {
		await inRollback(async (tx) => {
			const gone = await insertUser(tx, { deletedAt: new Date() });
			expect(await getUserCard(tx, asAdmin, crypto.randomUUID(), TODAY)).toBeNull();
			expect(await getUserCard(tx, asAdmin, 'nope', TODAY)).toBeNull();
			expect(await getUserCard(tx, asAdmin, gone.id, TODAY)).toBeNull();
		});
	});
});
