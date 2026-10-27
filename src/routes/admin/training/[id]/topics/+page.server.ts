import { error, fail, type RequestEvent } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import {
	createTopic,
	listTopics,
	moveTopic,
	setTopicHidden,
	updateTopic
} from '#lib/server/services/training/topics.ts';
import { flattenValues, formToObject, settingsErrors } from '#lib/validation/site-settings-form.ts';
import { topicFormSchema, topicIdSchema, topicMoveSchema } from '#lib/validation/training.ts';
import type { Actions, PageServerLoad } from './$types';

/* docs/05 section 27 "Topics" (admin): title ×3, order ↑ / ↓, hide / restore. */
export const load: PageServerLoad = async ({ locals, params }) => {
	requirePermission(locals.user, 'training.manage');
	return { topics: await listTopics(db, params.id) };
};

const outcome = (result: string) => {
	if (result === 'not_found') error(404, 'Not found');
	if (result === 'not_allowed') error(403, 'Forbidden');
	if (result === 'bad_state') return fail(400, { stateError: true as const });
	return { saved: true as const };
};

/** The title form; `topicId` set — a rename of that topic. */
async function readTitle(request: Request, withId: boolean) {
	const raw = formToObject(await request.formData());
	const id = withId ? topicIdSchema.safeParse(raw) : null;
	if (id && !id.success) error(404, 'Not found');
	const parsed = topicFormSchema.safeParse(raw);
	if (parsed.success) return { values: parsed.data, topicId: id?.data?.topicId ?? '' };
	return {
		failure: fail(400, {
			topicId: typeof raw.topicId === 'string' ? raw.topicId : '',
			values: flattenValues(raw),
			errors: settingsErrors(parsed.error)
		})
	};
}

async function hidden(event: RequestEvent<{ id: string }>, hide: boolean) {
	const actor = requirePermission(event.locals.user, 'training.manage');
	const parsed = topicIdSchema.safeParse(Object.fromEntries(await event.request.formData()));
	if (!parsed.success) error(404, 'Not found');
	const { id } = event.params;
	const ip = event.getClientAddress();
	return outcome(await setTopicHidden(db, actor, id, parsed.data.topicId, hide, ip));
}

export const actions: Actions = {
	create: async (event) => {
		const actor = requirePermission(event.locals.user, 'training.manage');
		const form = await readTitle(event.request, false);
		if (form.failure) return form.failure;
		const ip = event.getClientAddress();
		const result = await createTopic(db, actor, event.params.id, form.values, ip);
		return outcome(typeof result === 'string' ? result : 'ok');
	},
	update: async (event) => {
		const actor = requirePermission(event.locals.user, 'training.manage');
		const form = await readTitle(event.request, true);
		if (form.failure) return form.failure;
		const { id } = event.params;
		const ip = event.getClientAddress();
		return outcome(await updateTopic(db, actor, id, form.topicId, form.values, ip));
	},
	move: async (event) => {
		const actor = requirePermission(event.locals.user, 'training.manage');
		const parsed = topicMoveSchema.safeParse(Object.fromEntries(await event.request.formData()));
		if (!parsed.success) error(404, 'Not found');
		const { topicId, direction } = parsed.data;
		const ip = event.getClientAddress();
		return outcome(await moveTopic(db, actor, event.params.id, topicId, direction, ip));
	},
	hide: (event) => hidden(event, true),
	restore: (event) => hidden(event, false)
};
