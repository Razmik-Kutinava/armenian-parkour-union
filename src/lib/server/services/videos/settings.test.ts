import { and, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { auditLog, siteSettings } from '../../db/schema/service';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { VIDEO_DEFAULTS, parseVideoSettings, saveVideoSettings, videoSettings } from './settings';

/* docs/03 section 6.2 p. 7, 16: `site_settings.videos`; 5 a month, YouTube and Instagram by default. */

describe('parseVideoSettings', () => {
	it('defaults: 5 a month, YouTube and Instagram', () => {
		expect(VIDEO_DEFAULTS).toEqual({ monthlyLimit: 5, platforms: ['youtube', 'instagram'] });
	});

	it.each([undefined, null, 'x', [], {}])('missing or broken value %j → defaults', (value) => {
		expect(parseVideoSettings(value)).toEqual(VIDEO_DEFAULTS);
	});

	it('reads stored fields; a broken field falls back alone', () => {
		expect(parseVideoSettings({ monthly_limit: 2, platforms: ['instagram'] })).toEqual({
			monthlyLimit: 2,
			platforms: ['instagram']
		});
		expect(parseVideoSettings({ monthly_limit: 0, platforms: ['vimeo'] })).toEqual(VIDEO_DEFAULTS);
		expect(parseVideoSettings({ monthly_limit: 1.5, platforms: [] })).toEqual(VIDEO_DEFAULTS);
	});
});

/* docs/05 section 21 "Rule parameters": admin only, every change in audit_log (docs/todo.md 7.2). */
describe.skipIf(!testDbUrl)('saveVideoSettings', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('an admin saves: the stored key reads back, the change is logged', async () => {
		await inRollback(async (tx) => {
			const { id } = await insertUser(tx, { role: 'admin' });
			const admin = { id, role: 'admin' as const };
			const values = { monthlyLimit: 3, platforms: ['instagram' as const] };
			expect(await saveVideoSettings(tx, admin, values, '10.0.0.5')).toBe('ok');
			const [row] = await tx.select().from(siteSettings).where(eq(siteSettings.key, 'videos'));
			expect(row.value).toEqual({ monthly_limit: 3, platforms: ['instagram'] });
			expect(await videoSettings(tx)).toEqual(values);
			const [entry] = await tx
				.select()
				.from(auditLog)
				.where(and(eq(auditLog.actorId, id), eq(auditLog.action, 'settings.update')));
			expect(entry.after).toEqual({ videos: { monthly_limit: 3, platforms: ['instagram'] } });
			expect(entry.ip).toBe('10.0.0.5');
		});
	});

	it('a moderator or editor may not; nothing is stored', async () => {
		await inRollback(async (tx) => {
			const [before] = await tx.select().from(siteSettings).where(eq(siteSettings.key, 'videos'));
			for (const role of ['moderator', 'editor'] as const) {
				const { id } = await insertUser(tx, { role });
				expect(
					await saveVideoSettings(
						tx,
						{ id, role },
						{ monthlyLimit: 9, platforms: ['youtube'] },
						null
					)
				).toBe('not_admin');
			}
			const [after] = await tx.select().from(siteSettings).where(eq(siteSettings.key, 'videos'));
			expect(after).toEqual(before);
		});
	});
});
