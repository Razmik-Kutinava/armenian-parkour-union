import { error } from '@sveltejs/kit';
import { readListState } from '#lib/components/admin/list-state.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { can } from '#lib/server/auth/permissions.ts';
import { db } from '#lib/server/db/index.ts';
import { listEventCategories } from '#lib/server/services/events/categories.ts';
import { getEvent } from '#lib/server/services/events/list.ts';
import {
	addRegistration,
	cancelByStaffNow,
	listRegistrations,
	promoteNow,
	registrationCounts,
	registrationListOptions
} from '#lib/server/services/registrations/staff/index.ts';
import { done, refused } from './outcome';
import type { Actions, PageServerLoad } from './$types';

/* docs/05 section 5, tab "Registrations": moderator and admin read; the actions — registrations.manage. */
export const load: PageServerLoad = async ({ locals, params, url }) => {
	const viewer = requirePermission(locals.user, 'registrations.read');
	const event = await getEvent(db, params.id);
	if (!event) error(404, 'Not found');
	const state = readListState(url.searchParams, registrationListOptions);
	const [list, categories, counts] = await Promise.all([
		listRegistrations(db, viewer, event.id, state),
		listEventCategories(db, event.id),
		registrationCounts(db, [event.id])
	]);
	if (!list) error(404, 'Not found');
	const { id, title, status, startsAt, endsAt, capacity, priceAmountMinor } = event;
	return {
		event: { id, title, status, startsAt, endsAt, capacity, paid: priceAmountMinor > 0 },
		counts: counts.get(id) ?? { seats: 0, waitlist: 0 },
		categories: categories.map((c) => ({ id: c.id, name: c.name })),
		state,
		...list,
		canManage: can(viewer, 'registrations.manage'),
		canPayments: can(viewer, 'payments.read')
	};
};

const field = (form: FormData, name: string) => String(form.get(name) ?? '');

export const actions: Actions = {
	promote: async ({ locals, params, request, getClientAddress }) => {
		const actor = requirePermission(locals.user, 'registrations.manage');
		const registrationId = field(await request.formData(), 'registrationId');
		const ref = { eventId: params.id, registrationId };
		const result = await promoteNow(db, actor, ref, getClientAddress());
		return result === 'ok' ? done('registrationsAdmin.done.promoted') : refused(result);
	},
	cancel: async ({ locals, params, request, getClientAddress }) => {
		const actor = requirePermission(locals.user, 'registrations.manage');
		const form = await request.formData();
		const ref = {
			eventId: params.id,
			registrationId: field(form, 'registrationId'),
			reason: field(form, 'comment')
		};
		const result = await cancelByStaffNow(db, actor, ref, getClientAddress());
		return result === 'ok' ? done('registrationsAdmin.done.cancelled') : refused(result);
	},
	add: async ({ locals, params, request, getClientAddress }) => {
		const actor = requirePermission(locals.user, 'registrations.manage');
		const form = await request.formData();
		const input = {
			eventId: params.id,
			member: field(form, 'member').slice(0, 320),
			categoryId: field(form, 'categoryId') || null
		};
		const result = await addRegistration(db, actor, input, getClientAddress());
		return result.ok ? done('registrationsAdmin.done.added') : refused(result.reason);
	}
};
