import { error, fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { can } from '#lib/server/auth/permissions.ts';
import { db } from '#lib/server/db/index.ts';
import { listEventCategories } from '#lib/server/services/events/categories.ts';
import {
	cancelEvent,
	changeEventStatus,
	deleteEvent,
	duplicateEvent,
	updateEvent
} from '#lib/server/services/events/edit.ts';
import type { StatusAction } from '#lib/server/services/events/lifecycle.ts';
import { getEvent } from '#lib/server/services/events/list.ts';
import { cancelReasonSchema } from '#lib/validation/events.ts';
import { coverChoices, readEventForm, refused } from '../form';
import { categoryCreate, categoryDelete, categoryUpdate } from './categories';
import { formValues } from './values';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const user = requirePermission(locals.user, 'events.write');
	const event = await getEvent(db, params.id);
	if (!event) error(404, 'Not found');
	const { id, slug, title, status, publishedAt, startsAt } = event;
	return {
		...(await coverChoices()),
		event: { id, slug, title, status, publishedAt, started: startsAt <= new Date() },
		canCancel: can(user, 'events.cancel'),
		categories: await listEventCategories(db, id),
		values: formValues(event)
	};
};

const missing = (result: 'not_found' | 'not_allowed') =>
	result === 'not_found' ? error(404, 'Not found') : error(403, 'Forbidden');

async function runStatus(event: RequestEvent<{ id: string }>, action: StatusAction) {
	const permission =
		action === 'publish' || action === 'unpublish' ? 'events.write' : 'events.cancel';
	const actor = requirePermission(event.locals.user, permission);
	const ip = event.getClientAddress();
	const result = await changeEventStatus(db, actor, event.params.id, action, ip);
	if (result === 'bad_status') return fail(400, { badStatus: true as const });
	if (result !== 'ok') missing(result);
	return { saved: true as const };
}

export const actions: Actions = {
	update: async (event) => {
		const actor = requirePermission(event.locals.user, 'events.write');
		const form = await readEventForm(event.request);
		if (form.failure) return form.failure;
		const ip = event.getClientAddress();
		const result = await updateEvent(db, actor, event.params.id, form.values, ip);
		if (result !== 'ok') return refused(result, form.raw);
		return { saved: true as const };
	},
	status: async (event) => {
		requirePermission(event.locals.user, 'events.write');
		const action = (await event.request.formData()).get('action');
		if (action !== 'publish' && action !== 'unpublish') return fail(400, { badStatus: true });
		return runStatus(event, action);
	},
	finish: (event) => runStatus(event, 'finish'),
	archive: (event) => runStatus(event, 'archive'),
	restore: (event) => runStatus(event, 'restore'),
	cancel: async (event) => {
		const actor = requirePermission(event.locals.user, 'events.cancel');
		const reason = cancelReasonSchema.safeParse((await event.request.formData()).get('comment'));
		if (!reason.success) return fail(400, { badReason: true as const });
		const ip = event.getClientAddress();
		const result = await cancelEvent(db, actor, event.params.id, reason.data, ip);
		if (result === 'bad_status') return fail(400, { badStatus: true as const });
		if (result !== 'ok') missing(result);
		return { saved: true as const };
	},
	duplicate: async (event) => {
		const actor = requirePermission(event.locals.user, 'events.write');
		const result = await duplicateEvent(db, actor, event.params.id, event.getClientAddress());
		if (typeof result === 'string') missing(result);
		else redirect(303, `/admin/events/${result.id}`);
	},
	delete: async (event) => {
		const actor = requirePermission(event.locals.user, 'events.write');
		const result = await deleteEvent(db, actor, event.params.id, event.getClientAddress());
		if (result !== 'ok') missing(result);
		redirect(303, '/admin/events');
	},
	categoryCreate,
	categoryUpdate,
	categoryDelete
};
