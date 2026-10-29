import { error } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { listPartnersAdmin } from '#lib/server/services/volunteer/partner-list.ts';
import { movePartner } from '#lib/server/services/volunteer/partner-order.ts';
import { publicUrl } from '#lib/server/storage/r2.ts';
import { partnerMoveSchema } from '#lib/validation/volunteer-partners.ts';
import type { Actions, PageServerLoad } from './$types';

/* docs/05 section 28 "Partners": the list in check-page order, ↑ / ↓. */
export const load: PageServerLoad = async ({ locals }) => {
	requirePermission(locals.user, 'volunteer.manage');
	const partners = await listPartnersAdmin(db);
	return {
		partners: partners.map((p) => ({ ...p, logoUrl: p.logoKey ? publicUrl(p.logoKey) : null }))
	};
};

export const actions: Actions = {
	move: async (event) => {
		const actor = requirePermission(event.locals.user, 'volunteer.manage');
		const form = Object.fromEntries(await event.request.formData());
		const parsed = partnerMoveSchema.safeParse(form);
		if (!parsed.success) error(404, 'Not found');
		const { partnerId, direction } = parsed.data;
		const ip = event.getClientAddress();
		const result = await movePartner(db, actor, partnerId, direction, ip);
		if (result === 'not_found') error(404, 'Not found');
		if (result === 'not_allowed') error(403, 'Forbidden');
		return { moved: true as const };
	}
};
