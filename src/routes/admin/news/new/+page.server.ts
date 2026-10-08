import { redirect } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { createPost } from '#lib/server/services/posts/edit.ts';
import { formChoices, readPostForm, refused } from '../form';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = requirePermission(locals.user, 'posts.write');
	return { ...(await formChoices()), authorId: user.id };
};

export const actions: Actions = {
	default: async (event) => {
		const actor = requirePermission(event.locals.user, 'posts.write');
		const form = await readPostForm(event.request);
		if (form.failure) return form.failure;
		const result = await createPost(db, actor, form.values, event.getClientAddress());
		if (typeof result === 'string') return refused(result, form.raw);
		redirect(303, `/admin/news/${result.id}`);
	}
};
