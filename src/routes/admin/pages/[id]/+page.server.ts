import { error, fail, redirect } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { deletePage, updatePage } from '#lib/server/services/pages/edit.ts';
import { getPage } from '#lib/server/services/pages/list.ts';
import { flattenValues } from '#lib/validation/site-settings-form.ts';
import { readPageForm, slugTaken } from '../form';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	requirePermission(locals.user, 'pages.write');
	const page = await getPage(db, params.id);
	if (!page) error(404, 'Not found');
	const { slug, title, body, status } = page;
	return {
		page: { id: page.id, slug, title, status, isSystem: page.isSystem },
		values: flattenValues({ slug, title, body, status }),
		publicPath: slug === 'about' ? '/federation' : `/pages/${slug}`
	};
};

export const actions: Actions = {
	update: async (event) => {
		const actor = requirePermission(event.locals.user, 'pages.write');
		const form = await readPageForm(event.request);
		if (form.failure) return form.failure;
		const ip = event.getClientAddress();
		const result = await updatePage(db, actor, event.params.id, form.values, ip);
		if (result === 'slug_taken') return slugTaken(form.raw);
		if (result === 'not_found') error(404, 'Not found');
		if (result === 'not_allowed') error(403, 'Forbidden');
		return { saved: true as const };
	},
	delete: async (event) => {
		const actor = requirePermission(event.locals.user, 'pages.write');
		const result = await deletePage(db, actor, event.params.id, event.getClientAddress());
		if (result === 'not_found') error(404, 'Not found');
		if (result === 'not_allowed') error(403, 'Forbidden');
		if (result === 'system') return fail(400, { system: true as const });
		redirect(303, '/admin/pages');
	}
};
