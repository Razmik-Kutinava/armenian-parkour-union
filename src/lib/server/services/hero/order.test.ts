import { asc, eq, isNull } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { heroBlocks } from '../../db/schema/hero';
import { auditLog } from '../../db/schema/service';
import { testDb, testDbUrl } from '../../db/test-db';
import { archiveHeroBlock } from './edit';
import { reorderHeroBlocks } from './order';
import { IP, clearHero, createdHero, heroValues, staff } from './test-support';

/* docs/05 section 4: order by drag and drop or ↑ / ↓ — the page sends the whole list. */

describe.skipIf(!testDbUrl)('hero: order of blocks', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	const order = async (tx: LimitDb) =>
		(
			await tx
				.select({ id: heroBlocks.id })
				.from(heroBlocks)
				.where(isNull(heroBlocks.archivedAt))
				.orderBy(asc(heroBlocks.sortOrder))
		).map((r) => r.id);

	it('saves the list as sent, in one log entry', async () => {
		await inRollback(async (tx) => {
			await clearHero(tx);
			const actor = await staff(tx);
			const [a, b, c] = [
				await createdHero(tx, actor, heroValues()),
				await createdHero(tx, actor, heroValues()),
				await createdHero(tx, actor, heroValues())
			];
			expect(await reorderHeroBlocks(tx, actor, [c, a, b], IP)).toBe('ok');
			expect(await order(tx)).toEqual([c, a, b]);
			const entries = await tx.select().from(auditLog).where(eq(auditLog.action, 'hero.reorder'));
			expect(entries.filter((e) => e.actorId === actor.id)).toMatchObject([
				{ entityType: 'hero_block', before: { order: [a, b, c] }, after: { order: [c, a, b] } }
			]);
		});
	});

	it('the list must hold exactly every block that is not archived', async () => {
		await inRollback(async (tx) => {
			await clearHero(tx);
			const actor = await staff(tx);
			const [a, b, old] = [
				await createdHero(tx, actor, heroValues()),
				await createdHero(tx, actor, heroValues()),
				await createdHero(tx, actor, heroValues())
			];
			expect(await archiveHeroBlock(tx, actor, old, IP)).toBe('ok');
			for (const ids of [[a], [b, a, old], [b, a, a], [b, crypto.randomUUID()], [b, 'nope'], []]) {
				expect(await reorderHeroBlocks(tx, actor, ids, IP), ids.join()).toBe('bad_order');
			}
			expect(await order(tx)).toEqual([a, b]);
			expect(await reorderHeroBlocks(tx, actor, [b, a], IP)).toBe('ok');
			expect(await order(tx)).toEqual([b, a]);
		});
	});

	it('moderator and member cannot reorder', async () => {
		await inRollback(async (tx) => {
			await clearHero(tx);
			const editor = await staff(tx);
			const [a, b] = [
				await createdHero(tx, editor, heroValues()),
				await createdHero(tx, editor, heroValues())
			];
			for (const role of ['moderator', 'member'] as const) {
				expect(await reorderHeroBlocks(tx, await staff(tx, role), [b, a], IP)).toBe('not_allowed');
			}
			expect(await order(tx)).toEqual([a, b]);
		});
	});
});
