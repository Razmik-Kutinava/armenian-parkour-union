import { error, fail, type RequestEvent } from '@sveltejs/kit';
import { readListState } from '#lib/components/admin/list-state.ts';
import type { MessageKey } from '#lib/i18n/translate.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import {
	listVideos,
	videoListOptions,
	videoStatusFilter
} from '#lib/server/services/videos/admin-list.ts';
import { moderateVideosNow } from '#lib/server/services/videos/moderate-now.ts';
import type { ModerationInput } from '#lib/server/services/videos/review.ts';
import { moderationFormSchema } from '#lib/validation/videos.ts';
import type { Actions, PageServerLoad } from './$types';

/* docs/05 section 11: the queue, quick buttons and a batch; moderator and admin. */
export const load: PageServerLoad = async ({ locals, url }) => {
	const viewer = requirePermission(locals.user, 'videos.moderate');
	const read = readListState(url.searchParams, videoListOptions);
	const state = { ...read, filters: { ...read.filters, status: videoStatusFilter(read) } };
	const { rows, total } = await listVideos(db, state);
	return { state, rows, total, viewerId: viewer.id };
};

async function moderate(event: RequestEvent, input: (comment: string) => ModerationInput) {
	const actor = requirePermission(event.locals.user, 'videos.moderate');
	const form = await event.request.formData();
	const comment = form.get('comment');
	const parsed = moderationFormSchema.safeParse({
		ids: form.getAll('ids').map(String),
		comment: typeof comment === 'string' ? comment : undefined
	});
	if (!parsed.success) {
		return fail(400, { message: parsed.error.issues[0].message as MessageKey });
	}
	const { ids } = parsed.data;
	const result = await moderateVideosNow(
		db,
		actor,
		ids,
		input(parsed.data.comment),
		event.getClientAddress()
	);
	if (!result.ok && result.reason === 'not_allowed') error(403, 'Forbidden');
	if (!result.ok) return fail(400, { message: 'videos.admin.error.reason' as MessageKey });
	return { done: result.done, skipped: result.skipped };
}

export const actions: Actions = {
	approve: (event) => moderate(event, () => ({ action: 'approve' })),
	reject: (event) => moderate(event, (reason) => ({ action: 'reject', reason })),
	hide: (event) => moderate(event, () => ({ action: 'hide' }))
};
