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
import type { LimitDb } from '../auth/rate-limit';
import { siteSettings } from '../db/schema/service';

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
