import { isDeepStrictEqual } from 'node:util';
import { inArray } from 'drizzle-orm';
import type { z } from 'zod';
import { pickLocalized } from '#lib/i18n/localized.ts';
import type { Locale } from '#lib/i18n/locales.ts';
import {
	contactsSchema,
	footerSchema,
	requisitesSchema,
	socialNetworks,
	socialsSchema,
	type SocialNetwork
} from '#lib/validation/site-settings.ts';
import {
	settingKeys,
	settingsFormSchema,
	type SettingsValues
} from '#lib/validation/site-settings-form.ts';
import type { LimitDb } from '../auth/rate-limit';
import { siteSettings } from '../db/schema/service';
import { writeAudit } from './audit';
import type { Actor } from './users/target';

export type FooterSettings = {
	contacts: { email?: string; phone?: string; address?: string; mapUrl?: string } | null;
	socials: { name: SocialNetwork; url: string }[];
	text: string | null;
	requisites: string | null;
};

const keys = ['contacts', 'socials', 'footer', 'requisites'];

/** A missing or invalid key is simply not shown: the footer never breaks the page. */
function parse<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> | null {
	const result = schema.safeParse(value);
	return result.success ? result.data : null;
}

/** Stored values for the admin form; a broken value is left out (the form shows it empty). */
export async function getAdminSettings(db: LimitDb): Promise<Partial<SettingsValues>> {
	const rows = await db.select().from(siteSettings).where(inArray(siteSettings.key, settingKeys));
	const result: Partial<Record<keyof SettingsValues, unknown>> = {};
	for (const key of settingKeys) {
		const row = rows.find((r) => r.key === key);
		const parsed = row && settingsFormSchema.shape[key].safeParse(row.value);
		if (parsed?.success) result[key] = parsed.data;
	}
	return result as Partial<SettingsValues>;
}

/** docs/05 section 21: every changed key goes to audit_log with the old and new value, atomically. */
export async function saveSettings(
	db: LimitDb,
	actor: Actor,
	values: SettingsValues,
	ip: string | null
): Promise<'ok' | 'not_admin'> {
	if (actor.role !== 'admin') return 'not_admin';
	return db.transaction(async (tx) => {
		const rows = await tx
			.select()
			.from(siteSettings)
			.where(inArray(siteSettings.key, settingKeys))
			.for('update');
		for (const key of settingKeys) {
			const before = rows.find((r) => r.key === key)?.value ?? null;
			const after = values[key];
			if (isDeepStrictEqual(before, after)) continue;
			await tx
				.insert(siteSettings)
				.values({ key, value: after, updatedBy: actor.id })
				.onConflictDoUpdate({
					target: siteSettings.key,
					set: { value: after, updatedBy: actor.id }
				});
			await writeAudit(tx, {
				actorId: actor.id,
				action: 'settings.update',
				entityType: 'site_settings',
				before: before === null ? null : { [key]: before },
				after: { [key]: after },
				ip
			});
		}
		return 'ok' as const;
	});
}

export async function getFooterSettings(db: LimitDb, locale: Locale): Promise<FooterSettings> {
	const rows = await db.select().from(siteSettings).where(inArray(siteSettings.key, keys));
	const value = (key: string) => rows.find((r) => r.key === key)?.value;

	const c = parse(contactsSchema, value('contacts'));
	const contacts = c && {
		...(c.email && { email: c.email }),
		...(c.phone && { phone: c.phone }),
		...(c.address && { address: pickLocalized(c.address, locale) }),
		...(c.mapUrl && { mapUrl: c.mapUrl })
	};
	const s = parse(socialsSchema, value('socials'));
	const footer = parse(footerSchema, value('footer'));
	const requisites = parse(requisitesSchema, value('requisites'));

	return {
		contacts: contacts && Object.keys(contacts).length > 0 ? contacts : null,
		socials: socialNetworks.flatMap((name) => (s?.[name] ? [{ name, url: s[name] }] : [])),
		text: footer?.text ? pickLocalized(footer.text, locale) : null,
		requisites: requisites?.text ? pickLocalized(requisites.text, locale) : null
	};
}
