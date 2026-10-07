import { z } from 'zod';

/* Footer keys of site_settings (docs/05 section 21; format — docs/decisions.md, 1.8). */

const text = z.string().trim().min(1).max(2000);
const localized = z.object({ en: text, hy: text.optional(), ru: text.optional() });
/** Links end up in href: only https, so no javascript: or data: URLs. */
const httpsUrl = z.url({ protocol: /^https$/ }).max(500);

export const contactsSchema = z.object({
	email: z.email().max(254).optional(),
	phone: z.string().trim().min(1).max(40).optional(),
	address: localized.optional(),
	mapUrl: httpsUrl.optional()
});

export const socialNetworks = ['instagram', 'youtube', 'telegram', 'facebook', 'tiktok'] as const;
export type SocialNetwork = (typeof socialNetworks)[number];

export const socialsSchema = z.object(
	Object.fromEntries(socialNetworks.map((n) => [n, httpsUrl.optional()])) as Record<
		SocialNetwork,
		z.ZodOptional<typeof httpsUrl>
	>
);

export const footerSchema = z.object({ text: localized.optional() });
export const requisitesSchema = z.object({ text: localized.optional() });
