import { existsSync } from 'node:fs';
import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const url = process.env.DATABASE_URL;

class Rollback extends Error {}

/* docs/02 section 12 (partners, perks, cashiers, cards, redemptions). Every test is rolled back. */
describe.skipIf(!url)('volunteer cards schema (migration 0018)', () => {
	const sql = postgres(url ?? '', { max: 1, onnotice: () => {} });
	afterAll(() => sql.end());

	async function inRollback(fn: (tx: postgres.TransactionSql) => Promise<void>) {
		await sql
			.begin(async (tx) => {
				await fn(tx);
				throw new Rollback();
			})
			.catch((e) => {
				if (!(e instanceof Rollback)) throw e;
			});
	}

	async function expectCode(tx: postgres.TransactionSql, code: string, query: () => Promise<unknown>) {
		const error = await tx.savepoint(() => query()).catch((e: unknown) => e);
		expect((error as postgres.PostgresError).code).toBe(code);
		return error as postgres.PostgresError;
	}

	const uid = () => crypto.randomUUID();
	const now = new Date();
	const insert = (tx: postgres.TransactionSql, table: string, values: Record<string, unknown>) =>
		tx`insert into ${tx(table)} ${tx(values)} returning *`.then((r) => r[0]);
	const newUser = (tx: postgres.TransactionSql) =>
		insert(tx, 'users', { email: `t-${uid()}@example.com`, name: 'Test' });
	const partner = (tx: postgres.TransactionSql, values = {}) =>
		insert(tx, 'volunteer_partners', { name: 'Partner', ...values });
	const perk = (tx: postgres.TransactionSql, p: string, values = {}) =>
		insert(tx, 'volunteer_perks', {
			partner_id: p,
			title: tx.json({ en: '10 % off' }),
			kind: 'reusable',
			...values
		});
	const cashier = (tx: postgres.TransactionSql, p: string, by: string, values = {}) =>
		insert(tx, 'partner_cashiers', { partner_id: p, label: 'Till 1', created_by: by, ...values });
	const card = (tx: postgres.TransactionSql, u: string, values = {}) =>
		insert(tx, 'volunteer_cards', { user_id: u, applied_at: now, ...values });

	it('partners and perks: drafts by default; single perks need a limit, dates in order', async () => {
		await inRollback(async (tx) => {
			const p = await partner(tx);
			expect(p).toMatchObject({ status: 'draft', sort_order: 0, logo_key: null, created_by: null });
			for (const key of ['created_at', 'updated_at']) expect(p[key]).toBeInstanceOf(Date);
			await expectCode(tx, '23502', () => partner(tx, { name: null }));
			await expectCode(tx, '22P02', () => partner(tx, { status: 'hidden' }));
			expect(await perk(tx, p.id)).toMatchObject({ status: 'draft', uses_limit: null, terms: null });
			await perk(tx, p.id, { kind: 'single', uses_limit: 1, valid_from: '2026-11-01' });
			await perk(tx, p.id, { valid_from: '2026-11-01', valid_until: '2026-11-01' });
			for (const values of [
				{ kind: 'single' },
				{ uses_limit: 2 },
				{ kind: 'single', uses_limit: 0 },
				{ valid_from: '2026-11-02', valid_until: '2026-11-01' }
			]) {
				await expectCode(tx, '23514', () => perk(tx, p.id, values));
			}
			await expectCode(tx, '23502', () => perk(tx, p.id, { title: null }));
			await expectCode(tx, '23503', () => perk(tx, uid()));
		});
	});

	it('cashiers: token hashes are unique, the author is required', async () => {
		await inRollback(async (tx) => {
			const [p, admin] = [await partner(tx), await newUser(tx)];
			const row = await cashier(tx, p.id, admin.id, { invite_token_hash: `i-${uid()}` });
			expect(row).toMatchObject({ device_token_hash: null, bound_at: null, disabled_at: null });
			await expectCode(tx, '23505', () =>
				cashier(tx, p.id, admin.id, { invite_token_hash: row.invite_token_hash })
			);
			const device = { device_token_hash: `d-${uid()}` };
			await cashier(tx, p.id, admin.id, device);
			await expectCode(tx, '23505', () => cashier(tx, p.id, admin.id, device));
			await expectCode(tx, '23502', () => cashier(tx, p.id, admin.id, { created_by: null }));
			await expectCode(tx, '23502', () => cashier(tx, p.id, admin.id, { label: null }));
		});
	});

	it('cards: one per member, unique number and token, notes for refusals', async () => {
		await inRollback(async (tx) => {
			const u = await newUser(tx);
			const row = await card(tx, u.id, { number: `APU-V-${uid()}`, public_token: uid() });
			expect(row).toMatchObject({ status: 'pending', decline_streak: 0, flagged_at: null });
			await expectCode(tx, '23505', () => card(tx, u.id));
			const fresh = async () => (await newUser(tx)).id;
			await expectCode(tx, '23505', async () => card(tx, await fresh(), { number: row.number }));
			const token = { public_token: row.public_token };
			await expectCode(tx, '23505', async () => card(tx, await fresh(), token));
			for (const status of ['rejected', 'revoked']) {
				await card(tx, await fresh(), { status, review_note: 'No membership' });
				await expectCode(tx, '23514', async () => card(tx, await fresh(), { status }));
				const blank = { status, review_note: ' ' };
				await expectCode(tx, '23514', async () => card(tx, await fresh(), blank));
			}
			const minus = { decline_streak: -1 };
			await expectCode(tx, '23514', async () => card(tx, await fresh(), minus));
			await expectCode(tx, '23502', async () => card(tx, await fresh(), { applied_at: null }));
		});
	});

	it('redemptions: a mark by a cashier, a reversal by an admin once, nothing else', async () => {
		await inRollback(async (tx) => {
			const [p, admin, u] = [await partner(tx), await newUser(tx), await newUser(tx)];
			const [pk, c, cs] = [await perk(tx, p.id), await card(tx, u.id), await cashier(tx, p.id, admin.id)];
			const base = { card_id: c.id, perk_id: pk.id, partner_id: p.id };
			const redeem = (values: Record<string, unknown>) =>
				insert(tx, 'perk_redemptions', { ...base, ...values });
			const mark = await redeem({ cashier_id: cs.id });
			expect(mark).toMatchObject({ reversal_of_id: null, comment: null, created_by: null });
			const reversal = { reversal_of_id: mark.id, comment: 'Mistake', created_by: admin.id };
			await redeem(reversal);
			await expectCode(tx, '23505', () => redeem(reversal));
			const other = await redeem({ cashier_id: cs.id });
			for (const values of [
				{},
				{ cashier_id: cs.id, comment: 'Note' },
				{ cashier_id: cs.id, created_by: admin.id },
				{ ...reversal, reversal_of_id: other.id, cashier_id: cs.id },
				{ ...reversal, reversal_of_id: other.id, comment: null },
				{ ...reversal, reversal_of_id: other.id, comment: '  ' },
				{ ...reversal, reversal_of_id: other.id, created_by: null }
			]) {
				await expectCode(tx, '23514', () => redeem(values));
			}
			await expectCode(tx, '23503', () => redeem({ cashier_id: uid() }));
			for (const query of [
				() => tx`update perk_redemptions set comment = 'x' where id = ${mark.id}`,
				() => tx`delete from perk_redemptions where id = ${mark.id}`,
				() => tx`truncate perk_redemptions`
			]) {
				expect((await expectCode(tx, '23001', query)).message).toContain('append-only');
			}
		});
	});
});
