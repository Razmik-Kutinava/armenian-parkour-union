import { error, fail, type RequestEvent } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import {
	createEventCategory,
	deleteEventCategory,
	updateEventCategory
} from '#lib/server/services/events/categories.ts';
import { eventCategorySchema } from '#lib/validation/events.ts';
import { formToObject, settingsErrors } from '#lib/validation/site-settings-form.ts';

/* docs/05 section 5, tab "Categories": add, edit, delete; events.write on the server. */

const missing = (result: 'not_found' | 'not_allowed') =>
	result === 'not_found' ? error(404, 'Not found') : error(403, 'Forbidden');

async function readCategory(event: RequestEvent) {
	const raw = formToObject(await event.request.formData());
	const categoryId = typeof raw.categoryId === 'string' ? raw.categoryId : '';
	const parsed = eventCategorySchema.safeParse(raw);
	return { raw, categoryId, parsed };
}

export async function categoryCreate(event: RequestEvent<{ id: string }>) {
	const actor = requirePermission(event.locals.user, 'events.write');
	const { parsed } = await readCategory(event);
	if (!parsed.success) {
		return fail(400, { category: 'new', categoryErrors: settingsErrors(parsed.error) });
	}
	const ip = event.getClientAddress();
	const result = await createEventCategory(db, actor, event.params.id, parsed.data, ip);
	if (typeof result === 'string') missing(result);
	return { categorySaved: true as const };
}

export async function categoryUpdate(event: RequestEvent<{ id: string }>) {
	const actor = requirePermission(event.locals.user, 'events.write');
	const { parsed, categoryId } = await readCategory(event);
	if (!parsed.success) {
		return fail(400, { category: categoryId, categoryErrors: settingsErrors(parsed.error) });
	}
	const ip = event.getClientAddress();
	const params = [db, actor, event.params.id, categoryId, parsed.data, ip] as const;
	const result = await updateEventCategory(...params);
	if (result !== 'ok') missing(result);
	return { categorySaved: true as const };
}

export async function categoryDelete(event: RequestEvent<{ id: string }>) {
	const actor = requirePermission(event.locals.user, 'events.write');
	const categoryId = String((await event.request.formData()).get('categoryId') ?? '');
	const ip = event.getClientAddress();
	const result = await deleteEventCategory(db, actor, event.params.id, categoryId, ip);
	if (result !== 'ok') missing(result);
	return { categorySaved: true as const };
}
