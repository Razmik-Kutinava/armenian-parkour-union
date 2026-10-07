import { error, fail, redirect } from '@sveltejs/kit';
import { can } from '#lib/server/auth/permissions.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { deleteMedia, updateAlt } from '#lib/server/services/media/edit.ts';
import { getMedia } from '#lib/server/services/media/list.ts';
import { findUsages } from '#lib/server/services/media/usage.ts';
import { publicUrl } from '#lib/server/storage/r2.ts';
import { altSchema } from '#lib/validation/media.ts';
import { fieldErrors } from '#lib/validation/form.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const viewer = requirePermission(locals.user, 'media.write');
	const file = await getMedia(db, params.id);
	if (!file) error(404, 'Not found');
	return {
		file: { ...file, url: publicUrl(file.key) },
		usages: await findUsages(db, file.key),
		canOpenUsers: can(viewer, 'users.read_limited')
	};
};

export const actions: Actions = {
	alt: async (event) => {
		const actor = requirePermission(event.locals.user, 'media.write');
		const form = await event.request.formData();
		const raw = { en: form.get('alt.en'), hy: form.get('alt.hy'), ru: form.get('alt.ru') };
		const parsed = altSchema.safeParse(
			Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v ?? undefined]))
		);
		if (!parsed.success) {
			const errors = Object.fromEntries(
				Object.entries(fieldErrors(parsed.error)).map(([k, v]) => [`alt.${k}`, v])
			);
			return fail(400, { errors });
		}
		const result = await updateAlt(
			db,
			actor,
			event.params.id,
			parsed.data,
			event.getClientAddress()
		);
		if (result === 'not_found') error(404, 'Not found');
		if (result === 'not_allowed') error(403, 'Forbidden');
		return { saved: true as const };
	},
	delete: async (event) => {
		const actor = requirePermission(event.locals.user, 'media.write');
		const result = await deleteMedia(db, actor, event.params.id, event.getClientAddress());
		if (result === 'not_found') error(404, 'Not found');
		if (result === 'not_allowed') error(403, 'Forbidden');
		if (result !== 'ok') return fail(400, { inUse: true as const });
		redirect(303, '/admin/media');
	}
};
