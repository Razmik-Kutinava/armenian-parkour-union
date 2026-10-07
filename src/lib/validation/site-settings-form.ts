import { z } from 'zod';
import type { MessageKey } from '#lib/i18n/translate.ts';
import {
	contactsSchema,
	footerSchema,
	localizedText,
	requisitesSchema,
	socialsSchema
} from './site-settings';

/* Admin form "Site settings" (docs/05 section 21; keys — decisions.md 2026-10-07). */

export const settingsFormSchema = z.object({
	site_name: localizedText(100),
	seo_description: localizedText(300),
	contacts: contactsSchema.default({}),
	socials: socialsSchema.default({}),
	footer: footerSchema.default({}),
	requisites: requisitesSchema.default({})
});
export type SettingsValues = z.output<typeof settingsFormSchema>;
export const settingKeys = Object.keys(settingsFormSchema.shape) as (keyof SettingsValues)[];

const FORBIDDEN = new Set(['__proto__', 'prototype', 'constructor']);

/** `contacts.address.en` → `{ contacts: { address: { en } } }`; blank fields are left out. */
export function formToObject(form: FormData): Record<string, unknown> {
	const root: Record<string, unknown> = {};
	for (const [name, raw] of form) {
		if (typeof raw !== 'string' || raw.trim() === '') continue;
		const path = name.split('.');
		if (path.length > 3 || path.some((p) => !p || FORBIDDEN.has(p))) continue;
		let node = root;
		for (const key of path.slice(0, -1)) {
			if (typeof node[key] !== 'object' || node[key] === null) node[key] = {};
			node = node[key] as Record<string, unknown>;
		}
		node[path[path.length - 1]] = raw.trim();
	}
	return root;
}

/** Back to form field values for the inputs. */
export function flattenValues(value: unknown, prefix = ''): Record<string, string> {
	if (typeof value === 'string') return prefix ? { [prefix]: value } : {};
	if (typeof value !== 'object' || value === null) return {};
	return Object.assign(
		{},
		...Object.entries(value).map(([k, v]) => flattenValues(v, prefix ? `${prefix}.${k}` : k))
	);
}

/** First error per field, keyed by the full dotted name of the input. */
export function settingsErrors(error: z.ZodError): Partial<Record<string, MessageKey>> {
	const errors: Partial<Record<string, MessageKey>> = {};
	for (const issue of error.issues) errors[issue.path.join('.')] ??= issue.message as MessageKey;
	return errors;
}
