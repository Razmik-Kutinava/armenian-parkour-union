import { eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { heroBlocks } from '../../db/schema/hero';
import { auditLog, siteSettings } from '../../db/schema/service';
import { testDb, testDbUrl } from '../../db/test-db';
import { archiveHeroBlock } from './edit';
import { setHeroActive } from './toggle';
import { IP, clearHero, createdHero, heroValues, setHeroLimit, staff } from './test-support';

/* docs/05 section 4: on / off switch; docs/03 section 11: limit `hero_max_active`. */

describe.skipIf(!testDbUrl)('hero: switching blocks on and off', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	const activeOf = async (tx: LimitDb, id: string) =>
		(await tx.select().from(heroBlocks).where(eq(heroBlocks.id, id)))[0].isActive;
	const actionsOf = async (tx: LimitDb, id: string) =>
		(await tx.select().from(auditLog).where(eq(auditLog.entityId, id))).map((e) => e.action);

	it('editor switches a block on and off; each change is logged once', async () => {
		await inRollback(async (tx) => {
			await clearHero(tx);
			const actor = await staff(tx);
			const id = await createdHero(tx, actor, heroValues());
			expect(await setHeroActive(tx, actor, id, true, IP)).toBe('ok');
			expect(await activeOf(tx, id)).toBe(true);
			expect(await setHeroActive(tx, actor, id, true, IP)).toBe('ok');
			expect(await setHeroActive(tx, actor, id, false, IP)).toBe('ok');
			expect(await activeOf(tx, id)).toBe(false);
			expect(await actionsOf(tx, id)).toEqual(['hero.create', 'hero.activate', 'hero.deactivate']);
		});
	});

	it('the limit from settings refuses one more active block; switching off is always allowed', async () => {
		await inRollback(async (tx) => {
			await clearHero(tx);
			await setHeroLimit(tx, 2);
			const actor = await staff(tx);
			const ids = [];
			for (let i = 0; i < 3; i++) ids.push(await createdHero(tx, actor, heroValues()));
			expect(await setHeroActive(tx, actor, ids[0], true, IP)).toBe('ok');
			expect(await setHeroActive(tx, actor, ids[1], true, IP)).toBe('ok');
			expect(await setHeroActive(tx, actor, ids[2], true, IP)).toBe('limit');
			expect(await activeOf(tx, ids[2])).toBe(false);
			expect(await setHeroActive(tx, actor, ids[0], false, IP)).toBe('ok');
			expect(await setHeroActive(tx, actor, ids[2], true, IP)).toBe('ok');
		});
	});

	it('without the setting the limit is 5', async () => {
		await inRollback(async (tx) => {
			await clearHero(tx);
			await tx.delete(siteSettings).where(inArray(siteSettings.key, ['hero_max_active']));
			const actor = await staff(tx);
			for (let i = 0; i < 5; i++) {
				const id = await createdHero(tx, actor, heroValues());
				expect(await setHeroActive(tx, actor, id, true, IP)).toBe('ok');
			}
			const sixth = await createdHero(tx, actor, heroValues());
			expect(await setHeroActive(tx, actor, sixth, true, IP)).toBe('limit');
		});
	});

	it('an archived block cannot be switched on and does not count', async () => {
		await inRollback(async (tx) => {
			await clearHero(tx);
			await setHeroLimit(tx, 1);
			const actor = await staff(tx);
			const old = await createdHero(tx, actor, heroValues({ isActive: true }));
			expect(await archiveHeroBlock(tx, actor, old, IP)).toBe('ok');
			expect(await setHeroActive(tx, actor, old, true, IP)).toBe('bad_state');
			const fresh = await createdHero(tx, actor, heroValues());
			expect(await setHeroActive(tx, actor, fresh, true, IP)).toBe('ok');
		});
	});

	it('moderator and member cannot switch; unknown id is not found', async () => {
		await inRollback(async (tx) => {
			await clearHero(tx);
			const id = await createdHero(tx, await staff(tx), heroValues());
			for (const role of ['moderator', 'member'] as const) {
				expect(await setHeroActive(tx, await staff(tx, role), id, true, IP)).toBe('not_allowed');
			}
			expect(await activeOf(tx, id)).toBe(false);
			const admin = await staff(tx, 'admin');
			expect(await setHeroActive(tx, admin, 'nope', true, IP)).toBe('not_found');
			expect(await setHeroActive(tx, admin, crypto.randomUUID(), true, IP)).toBe('not_found');
		});
	});
});
