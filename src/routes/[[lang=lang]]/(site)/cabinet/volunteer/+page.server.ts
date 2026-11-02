import { fail } from '@sveltejs/kit';
import { PUBLIC_SITE_URL } from '$app/env/private';
import type { MessageKey } from '#lib/i18n/translate.ts';
import { requireUser } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { sendMail } from '#lib/server/mail/index.ts';
import { qrSvg } from '#lib/server/services/certificates/qr-svg.ts';
import { applyForCard } from '#lib/server/services/volunteer/card-apply.ts';
import { ownCard } from '#lib/server/services/volunteer/card-own.ts';
import { cardCheckUrl } from '#lib/server/services/volunteer/card-rules.ts';
import { answerInvite } from '#lib/server/services/volunteer/invite-answer.ts';
import { listOwnInvites } from '#lib/server/services/volunteer/invite-own.ts';
import type { Actions, PageServerLoad } from './$types';

/* docs/06 section 5.12: card, perks, invitations. */

export const load: PageServerLoad = async ({ locals, setHeaders, url }) => {
	const user = requireUser(locals.user);
	setHeaders({ 'cache-control': 'no-store' });
	const [own, invites] = await Promise.all([ownCard(db, user.id), listOwnInvites(db, user.id)]);
	const checkUrl = own.checkToken
		? cardCheckUrl(PUBLIC_SITE_URL ?? url.origin, own.checkToken)
		: null;
	return { own, invites, qr: checkUrl ? qrSvg(checkUrl) : null };
};

const REFUSED: Record<'not_found' | 'blocked' | 'bad_state' | 'conditions', MessageKey> = {
	not_found: 'cabinet.volunteer.error.gone',
	blocked: 'cabinet.volunteer.error.blocked',
	bad_state: 'cabinet.volunteer.error.state',
	conditions: 'cabinet.volunteer.error.conditions'
};

const ANSWER_REFUSED: Record<string, MessageKey> = {
	not_found: 'cabinet.volunteer.error.gone',
	respond_by: 'cabinet.volunteer.inviteClosed',
	full: 'cabinet.volunteer.inviteFull',
	card: 'cabinet.volunteer.error.conditions',
	bad_state: 'cabinet.volunteer.error.state'
};

export const actions: Actions = {
	apply: async ({ locals, getClientAddress }) => {
		const user = requireUser(locals.user);
		const result = await applyForCard(db, user.id, {
			send: sendMail,
			siteUrl: PUBLIC_SITE_URL,
			ip: getClientAddress()
		});
		if (result.ok) return { applied: true as const };
		return fail(400, { message: REFUSED[result.reason] });
	},
	answer: async ({ locals, request }) => {
		const user = requireUser(locals.user);
		const form = Object.fromEntries(await request.formData());
		const invitationId = String(form.invitationId ?? '');
		const answer = form.answer === 'accepted' || form.answer === 'declined' ? form.answer : null;
		if (!answer) return fail(400, { message: ANSWER_REFUSED.bad_state });
		const result = await answerInvite(db, user.id, invitationId, answer);
		if (result.ok) return { answered: true as const };
		return fail(400, { message: ANSWER_REFUSED[result.reason] });
	}
};
