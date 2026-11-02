import { error, fail, redirect } from '@sveltejs/kit';
import { PUBLIC_SITE_URL } from '$app/env/private';
import type { MessageKey } from '#lib/i18n/translate.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { sendMail } from '#lib/server/mail/index.ts';
import { closeRequestInvites } from '#lib/server/services/volunteer/invite-close.ts';
import {
	finishRequest,
	markInvite,
	marksOpen,
	type MarkKind
} from '#lib/server/services/volunteer/invite-mark.ts';
import {
	cancelRequest,
	countNewInvites,
	inviteMore,
	publishRequest,
	updateRequest
} from '#lib/server/services/volunteer/requests-admin.ts';
import { getRequest } from '#lib/server/services/volunteer/requests-list.ts';
import { toYerevanInput } from '#lib/validation/posts.ts';
import { readRequestForm, refused } from '../form';
import type { Actions, PageServerLoad } from './$types';

/* docs/05 section 28 request card: edit, send, invite more, cancel, mark, finish. */

const mailDeps = (event: { getClientAddress: () => string }) => ({
	send: sendMail,
	siteUrl: PUBLIC_SITE_URL,
	ip: event.getClientAddress()
});

export const load: PageServerLoad = async ({ locals, params }) => {
	requirePermission(locals.user, 'volunteer.manage');
	const now = new Date();
	let row = await getRequest(db, params.id);
	if (!row) error(404);
	if (row.status === 'open' && !row.closedAt && row.respondBy <= now) {
		await closeRequestInvites(db, row.id, now, {
			send: sendMail,
			siteUrl: PUBLIC_SITE_URL
		});
		row = (await getRequest(db, params.id)) ?? row;
	}
	const pendingInvites =
		row.status === 'draft' || row.status === 'open' ? await countNewInvites(db, row.id) : 0;
	return {
		row,
		pendingInvites,
		canMark: row.status === 'open' && marksOpen(row.startsAt, now),
		formValues: {
			'title.en': row.title.en,
			'title.hy': row.title.hy ?? '',
			'title.ru': row.title.ru ?? '',
			'description.en': row.description?.en ?? '',
			'description.hy': row.description?.hy ?? '',
			'description.ru': row.description?.ru ?? '',
			eventId: row.eventId ?? '',
			startsAt: toYerevanInput(row.startsAt),
			endsAt: toYerevanInput(row.endsAt),
			location: row.location ?? '',
			places: String(row.places),
			respondBy: toYerevanInput(row.respondBy)
		}
	};
};

const MARKS: MarkKind[] = ['attended', 'no_show', 'excused'];

export const actions: Actions = {
	update: async (event) => {
		const actor = requirePermission(event.locals.user, 'volunteer.manage');
		const form = await readRequestForm(event.request);
		if (form.failure) return form.failure;
		const result = await updateRequest(
			db,
			actor,
			event.params.id,
			form.values,
			event.getClientAddress()
		);
		if (!result.ok) return refused(result.reason, form.raw);
		return { saved: true as const };
	},
	publish: async (event) => {
		const actor = requirePermission(event.locals.user, 'volunteer.manage');
		const result = await publishRequest(db, actor, event.params.id, mailDeps(event));
		if (!result.ok) {
			if (result.reason === 'not_allowed') error(403);
			return fail(400, { message: 'volunteer.requests.error.state' as MessageKey });
		}
		return { published: result.invited };
	},
	inviteMore: async (event) => {
		const actor = requirePermission(event.locals.user, 'volunteer.manage');
		const result = await inviteMore(db, actor, event.params.id, mailDeps(event));
		if (!result.ok) {
			if (result.reason === 'not_allowed') error(403);
			return fail(400, {
				message: (result.reason === 'respond_by'
					? 'volunteer.requests.error.respondBy'
					: 'volunteer.requests.error.state') as MessageKey
			});
		}
		return { invitedMore: result.invited };
	},
	cancel: async (event) => {
		const actor = requirePermission(event.locals.user, 'volunteer.manage');
		const result = await cancelRequest(db, actor, event.params.id, mailDeps(event));
		if (!result.ok) {
			if (result.reason === 'not_allowed') error(403);
			return fail(400, { message: 'volunteer.requests.error.state' as MessageKey });
		}
		redirect(303, '/admin/volunteer/requests');
	},
	finish: async (event) => {
		const actor = requirePermission(event.locals.user, 'volunteer.manage');
		const result = await finishRequest(
			db,
			actor,
			event.params.id,
			event.getClientAddress(),
			new Date(),
			{ send: sendMail, siteUrl: PUBLIC_SITE_URL }
		);
		if (result === 'not_allowed') error(403);
		if (result === 'not_found') error(404);
		if (result !== 'ok') {
			return fail(400, { message: 'volunteer.requests.error.state' as MessageKey });
		}
		return { finished: true as const };
	},
	mark: async (event) => {
		const actor = requirePermission(event.locals.user, 'volunteer.manage');
		const data = await event.request.formData();
		const invitationId = String(data.get('invitationId') ?? '');
		const kind = String(data.get('kind') ?? '') as MarkKind;
		if (!MARKS.includes(kind)) {
			return fail(400, { message: 'volunteer.requests.error.state' as MessageKey });
		}
		const result = await markInvite(
			db,
			actor,
			invitationId,
			kind,
			event.getClientAddress(),
			new Date(),
			{ send: sendMail, siteUrl: PUBLIC_SITE_URL }
		);
		if (result === 'not_allowed') error(403);
		if (result === 'not_found') error(404);
		if (result !== 'ok') {
			return fail(400, {
				message: (result === 'too_early'
					? 'volunteer.requests.error.tooEarly'
					: 'volunteer.requests.error.state') as MessageKey
			});
		}
		return { marked: true as const };
	}
};
