import { PUBLIC_SITE_URL } from '$app/env/private';
import { error, fail, type RequestEvent } from '@sveltejs/kit';
import type { MessageKey } from '#lib/i18n/translate.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { cashierInviteUrl } from '#lib/server/services/volunteer/cashier-access.ts';
import {
	createCashier,
	disableCashier,
	listCashiers,
	newCashierLink
} from '#lib/server/services/volunteer/cashiers-admin.ts';
import type { Actions, PageServerLoad } from './$types';

/* docs/05 section 28 "Cashiers": the link is in the action answer only — shown once, never stored. */
export const load: PageServerLoad = async ({ locals, params }) => {
	requirePermission(locals.user, 'volunteer.manage');
	return { cashiers: await listCashiers(db, params.id) };
};

function refuse(result: 'not_allowed' | 'not_found'): never {
	if (result === 'not_found') error(404, 'Not found');
	error(403, 'Forbidden');
}

const invite = (url: URL, label: string, link: { token: string; expiresAt: Date }) => ({
	invite: {
		label,
		link: cashierInviteUrl(PUBLIC_SITE_URL || url.origin, link.token),
		expiresAt: link.expiresAt
	}
});

const field = async (event: RequestEvent, name: string) =>
	String((await event.request.formData()).get(name) ?? '');

export const actions: Actions = {
	create: async (event) => {
		const actor = requirePermission(event.locals.user, 'volunteer.manage');
		const label = await field(event, 'label');
		const ip = event.getClientAddress();
		const result = await createCashier(db, actor, event.params.id, label, ip);
		if (result === 'bad_label')
			return fail(400, { label, error: 'volunteer.cashiers.error.label' as MessageKey });
		if (typeof result === 'string') refuse(result);
		return invite(event.url, label.trim(), result);
	},
	link: async (event) => {
		const actor = requirePermission(event.locals.user, 'volunteer.manage');
		const cashierId = await field(event, 'cashierId');
		const ip = event.getClientAddress();
		const result = await newCashierLink(db, actor, event.params.id, cashierId, ip);
		if (result === 'disabled')
			return fail(400, { error: 'volunteer.cashiers.error.disabled' as MessageKey });
		if (typeof result === 'string') refuse(result);
		const [row] = (await listCashiers(db, event.params.id)).filter((c) => c.id === cashierId);
		return invite(event.url, row?.label ?? '', result);
	},
	disable: async (event) => {
		const actor = requirePermission(event.locals.user, 'volunteer.manage');
		const cashierId = await field(event, 'cashierId');
		const ip = event.getClientAddress();
		const result = await disableCashier(db, actor, event.params.id, cashierId, ip);
		if (result !== 'ok') refuse(result);
		return { disabled: true as const };
	}
};
