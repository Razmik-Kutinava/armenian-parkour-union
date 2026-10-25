import { and, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { auditLog, siteSettings } from '../db/schema/service';
import { insertUser, testDb, testDbUrl } from '../db/test-db';
import { parseSiteLocales, saveSiteLocales, siteLocales } from './site-locales';

/* docs/06 section 1 p. 2: Armenian and Russian are switched on as translations get ready. */

describe('parseSiteLocales', () => {
	it.each([undefined, null, 'x', [], {}, { enabled: 'hy' }])(
		'missing or broken value %j → all three',
		(value) => {
			expect(parseSiteLocales(value)).toEqual(['en', 'hy', 'ru']);
		}
	);

	it('English is always on; order as in the switcher; unknown codes dropped', () => {
		expect(parseSiteLocales({ enabled: ['ru'] })).toEqual(['en', 'ru']);
		expect(parseSiteLocales({ enabled: ['ru', 'de', 'en', 'hy', 'ru'] })).toEqual([
			'en',
			'hy',
			'ru'
		]);
		expect(parseSiteLocales({ enabled: [] })).toEqual(['en']);
	});
});

/* docs/05 section 21: admin only, every change in audit_log. */
describe.skipIf(!testDbUrl)('saveSiteLocales', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('an admin switches Armenian off: stored, read back, logged', async () => {
		await inRollback(async (tx) => {
			const { id } = await insertUser(tx, { role: 'admin' });
			const admin = { id, role: 'admin' as const };
			expect(await saveSiteLocales(tx, admin, ['ru', 'xx'], '10.0.0.7')).toBe('ok');
			const [row] = await tx.select().from(siteSettings).where(eq(siteSettings.key, 'locales'));
			expect(row.value).toEqual({ enabled: ['en', 'ru'] });
			expect(await siteLocales(tx)).toEqual(['en', 'ru']);
			const [entry] = await tx
				.select()
				.from(auditLog)
				.where(and(eq(auditLog.actorId, id), eq(auditLog.action, 'settings.update')));
			expect(entry.after).toEqual({ locales: { enabled: ['en', 'ru'] } });
			expect(entry.ip).toBe('10.0.0.7');
		});
	});

	it('a moderator or editor may not; nothing is stored', async () => {
		await inRollback(async (tx) => {
			await tx.delete(siteSettings).where(eq(siteSettings.key, 'locales'));
			for (const role of ['moderator', 'editor'] as const) {
				const { id } = await insertUser(tx, { role });
				expect(await saveSiteLocales(tx, { id, role }, ['en'], null)).toBe('not_admin');
			}
			expect(await siteLocales(tx)).toEqual(['en', 'hy', 'ru']);
		});
	});
});
