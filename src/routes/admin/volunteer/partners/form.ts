import { error, fail } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.ts';
import { listImageChoices } from '#lib/server/services/media/list.ts';
import type { AdminPartner } from '#lib/server/services/volunteer/partners-admin.ts';
import type { AdminPerk } from '#lib/server/services/volunteer/perks-admin.ts';
import { publicUrl } from '#lib/server/storage/r2.ts';
import type { FieldErrors } from '#lib/validation/form.ts';
import { flattenValues, formToObject, settingsErrors } from '#lib/validation/site-settings-form.ts';
import {
	partnerFormSchema,
	perkFormSchema,
	type PartnerValues,
	type PerkValues
} from '#lib/validation/volunteer-partners.ts';

/* docs/05 section 28 "Partners": the partner and perk forms, checked on the server. */

const failure = (raw: Record<string, unknown>, errors: FieldErrors) =>
	fail(400, { values: flattenValues(raw), errors });

export async function readPartnerForm(request: Request) {
	const raw = formToObject(await request.formData());
	const parsed = partnerFormSchema.safeParse(raw);
	if (parsed.success) return { values: parsed.data as PartnerValues, raw };
	return { failure: failure(raw, settingsErrors(parsed.error)) };
}

export async function readPerkForm(request: Request) {
	const raw = formToObject(await request.formData());
	const parsed = perkFormSchema.safeParse(raw);
	if (parsed.success) return { values: parsed.data as PerkValues, raw };
	return { failure: failure(raw, settingsErrors(parsed.error)) };
}

/** Service refusals: the logo error at its field, 403 / 404 for the rest. */
export function refused(result: string, raw: Record<string, unknown>) {
	if (result === 'not_found') error(404, 'Not found');
	if (result === 'not_allowed') error(403, 'Forbidden');
	return failure(raw, { logoKey: 'volunteer.error.logo' });
}

/** The latest library images for the logo. */
export async function imageChoices() {
	const images = await listImageChoices(db);
	return { images: images.map((m) => ({ ...m, url: publicUrl(m.key) })) };
}

export const partnerFormValues = (p: AdminPartner): Record<string, string> => ({
	...flattenValues({ address: p.address }),
	name: p.name,
	logoKey: p.logoKey ?? '',
	website: p.website ?? '',
	status: p.status
});

export const perkFormValues = (p: AdminPerk): Record<string, string> => ({
	...flattenValues({ title: p.title, terms: p.terms }),
	kind: p.kind,
	usesLimit: p.usesLimit === null ? '' : String(p.usesLimit),
	validFrom: p.validFrom ?? '',
	validUntil: p.validUntil ?? '',
	status: p.status,
	sortOrder: String(p.sortOrder)
});
