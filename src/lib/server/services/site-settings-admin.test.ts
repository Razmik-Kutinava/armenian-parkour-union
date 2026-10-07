import { and, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../auth/rate-limit';
import { auditLog, siteSettings } from '../db/schema/service';
import { insertUser, testDb, testDbUrl } from '../db/test-db';
import { getAdminSettings, saveSettings } from './site-settings';

const IP = '198.51.100.9';
const values = {
	site_name: { en: 'APU' },
	seo_description: { en: 'Parkour' },
	contacts: { phone: '+374 10 000000' },
	socials: {},
	footer: {},
	requisites: {}
};

describe.skipIf(!testDbUrl)('site settings in the admin panel (docs/05 section 21)', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	const admin = async (tx: LimitDb) => ({
		id: (await insertUser(tx, { role: 'admin' })).id,
		role: 'admin' as const
	});
	/** The actor is created in the test, so all its entries come from the test. */
	const auditBy = (tx: LimitDb, actorId: string) =>
		tx
			.select()
			.from(auditLog)
			.where(and(eq(auditLog.actorId, actorId), eq(auditLog.action, 'settings.update')));

	it('saves every key; each changed key is logged with before and after', async () => {
		await inRollback(async (tx) => {
			const actor = await admin(tx);
			await tx.delete(siteSettings);
			await tx.insert(siteSettings).values({ key: 'contacts', value: { phone: '+374 11 111111' } });
			expect(await saveSettings(tx, actor, values, IP)).toBe('ok');

			const stored = await getAdminSettings(tx);
			expect(stored).toMatchObject({
				site_name: { en: 'APU' },
				contacts: { phone: '+374 10 000000' }
			});
			const [row] = await tx.select().from(siteSettings).where(eq(siteSettings.key, 'contacts'));
			expect(row.updatedBy).toBe(actor.id);

			const entries = await auditBy(tx, actor.id);
			const contacts = entries.find((e) => (e.after as Record<string, unknown>).contacts);
			expect(contacts).toMatchObject({
				entityType: 'site_settings',
				before: { contacts: { phone: '+374 11 111111' } },
				after: { contacts: { phone: '+374 10 000000' } },
				ip: IP
			});
			// site_name, seo_description, contacts, socials, footer, requisites were all new or changed
			expect(entries).toHaveLength(6);
		});
	});

	it('saving the same values again writes no audit entry', async () => {
		await inRollback(async (tx) => {
			const actor = await admin(tx);
			await saveSettings(tx, actor, values, IP);
			const before = (await auditBy(tx, actor.id)).length;
			expect(await saveSettings(tx, actor, values, IP)).toBe('ok');
			expect(await auditBy(tx, actor.id)).toHaveLength(before);
		});
	});

	it('only an admin saves; a broken stored value is shown as empty', async () => {
		await inRollback(async (tx) => {
			const mod = await insertUser(tx, { role: 'moderator' });
			expect(await saveSettings(tx, { id: mod.id, role: 'moderator' }, values, IP)).toBe(
				'not_admin'
			);
			await tx.delete(siteSettings);
			await tx.insert(siteSettings).values({ key: 'socials', value: { youtube: 'javascript:x' } });
			expect((await getAdminSettings(tx)).socials).toBeUndefined();
		});
	});
});
