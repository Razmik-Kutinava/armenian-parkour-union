import { z } from 'zod';

/* Footer keys of site_settings (docs/05 section 21; format — docs/decisions.md, 1.8). */

/* Messages are i18n keys: the admin form shows them at the field (1.10b). */
const textMax = (max: number) =>
	z
		.string({ error: 'auth.error.required' })
		.trim()
		.min(1, { error: 'auth.error.required' })
		.max(max, { error: 'auth.error.tooLong' });
export const localizedText = (max = 2000) =>
	z.object({ en: textMax(max), hy: textMax(max).optional(), ru: textMax(max).optional() });
const localized = localizedText();
/** Links end up in href: only https, so no javascript: or data: URLs. */
const httpsUrl = z
	.url({ protocol: /^https$/, error: 'settings.error.url' })
	.max(500, { error: 'auth.error.tooLong' });

export const contactsSchema = z.object({
	email: z
		.email({ error: 'auth.error.email' })
		.max(254, { error: 'auth.error.tooLong' })
		.optional(),
	phone: textMax(40).optional(),
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
