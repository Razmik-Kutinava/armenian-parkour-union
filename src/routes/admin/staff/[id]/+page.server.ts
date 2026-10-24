import { error, fail } from '@sveltejs/kit';
import type { MessageKey } from '#lib/i18n/translate.ts';
import { roleCan } from '#lib/server/auth/permissions.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { getStaffCard, updateStaffProfile } from '#lib/server/services/staff/admin-card.ts';
import { publicUrl } from '#lib/server/storage/r2.ts';
import { staffProfileSchema } from '#lib/validation/admin-staff.ts';
import { fieldErrors, keepValues } from '#lib/validation/form.ts';
import type { Actions, PageServerLoad } from './$types';

const FIELDS = ['category', 'licenseNumber', 'bioEn', 'bioHy', 'bioRu', 'isPublic', 'isActive'];

/* docs/05 section 9: the card for moderator and admin; the corrections — admin only. */
export const load: PageServerLoad = async ({ locals, params }) => {
	const viewer = requirePermission(locals.user, 'certificates.read');
	const found = await getStaffCard(db, params.id);
	if (!found) error(404, 'Not found');
	const { avatarKey, ...card } = found;
	return {
		card,
		photoUrl: avatarKey ? publicUrl(avatarKey) : null,
		canEdit: roleCan(viewer.role, 'staff_profiles.write')
	};
};

export const actions: Actions = {
	update: async ({ locals, params, request, getClientAddress }) => {
		const actor = requirePermission(locals.user, 'staff_profiles.write');
		const form = await request.formData();
		const values = keepValues(form, FIELDS);
		const parsed = staffProfileSchema.safeParse(Object.fromEntries(form));
		if (!parsed.success) return fail(400, { values, errors: fieldErrors(parsed.error) });
		const outcome = await updateStaffProfile(db, actor, params.id, parsed.data, getClientAddress());
		if (outcome === 'not_found') error(404, 'Not found');
		if (outcome === 'not_allowed') error(403, 'Forbidden');
		if (outcome === 'ok') return { done: 'staff.saved' as MessageKey };
		return fail(400, {
			values,
			errors: { isActive: `staff.refusal.${outcome}` as MessageKey }
		});
	}
};
