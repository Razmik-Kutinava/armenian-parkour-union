import { error, fail, redirect } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import {
	deletePost,
	duplicatePost,
	setPostStatus,
	updatePost
} from '#lib/server/services/posts/edit.ts';
import { getPost } from '#lib/server/services/posts/list.ts';
import { postStatuses, toYerevanInput, type PostStatus } from '#lib/validation/posts.ts';
import { flattenValues } from '#lib/validation/site-settings-form.ts';
import { formChoices, readPostForm, refused } from '../form';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	requirePermission(locals.user, 'posts.write');
	const post = await getPost(db, params.id);
	if (!post) error(404, 'Not found');
	const { slug, title, excerpt, body, status, coverKey, authorId, publishedAt } = post;
	const publishedAtText = publishedAt ? toYerevanInput(publishedAt).replace('T', ' ') : null;
	return {
		...(await formChoices()),
		post: { id: post.id, slug, title, status, publishedAt, publishedAtText },
		values: flattenValues({
			slug,
			title,
			excerpt,
			body,
			status,
			coverKey,
			authorId,
			tags: post.tags.join(', '),
			publishedAt: publishedAt ? toYerevanInput(publishedAt) : null
		})
	};
};

const isStatus = (v: unknown): v is PostStatus => postStatuses.includes(v as PostStatus);
const missing = (result: 'not_found' | 'not_allowed') =>
	result === 'not_found' ? error(404, 'Not found') : error(403, 'Forbidden');

export const actions: Actions = {
	update: async (event) => {
		const actor = requirePermission(event.locals.user, 'posts.write');
		const form = await readPostForm(event.request);
		if (form.failure) return form.failure;
		const ip = event.getClientAddress();
		const result = await updatePost(db, actor, event.params.id, form.values, ip);
		if (result !== 'ok') return refused(result, form.raw);
		return { saved: true as const };
	},
	status: async (event) => {
		const actor = requirePermission(event.locals.user, 'posts.write');
		const status = (await event.request.formData()).get('status');
		if (!isStatus(status)) return fail(400, { badStatus: true as const });
		const ip = event.getClientAddress();
		const result = await setPostStatus(db, actor, event.params.id, status, ip);
		if (result !== 'ok') missing(result);
		return { saved: true as const };
	},
	duplicate: async (event) => {
		const actor = requirePermission(event.locals.user, 'posts.write');
		const result = await duplicatePost(db, actor, event.params.id, event.getClientAddress());
		if (typeof result === 'string') missing(result);
		else redirect(303, `/admin/news/${result.id}`);
	},
	delete: async (event) => {
		const actor = requirePermission(event.locals.user, 'posts.write');
		const result = await deletePost(db, actor, event.params.id, event.getClientAddress());
		if (result !== 'ok') missing(result);
		redirect(303, '/admin/news');
	}
};
