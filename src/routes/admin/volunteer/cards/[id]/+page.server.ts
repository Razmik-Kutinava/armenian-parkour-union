import { error, fail, type RequestEvent } from '@sveltejs/kit';
import { PUBLIC_SITE_URL } from '$app/env/private';
import type { MessageKey } from '#lib/i18n/translate.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { sendMail } from '#lib/server/mail/index.ts';
import {
	decideCard,
	type CardDecisionInput
} from '#lib/server/services/volunteer/card-decision.ts';
import { cardCheckUrl } from '#lib/server/services/volunteer/card-rules.ts';
import { cardDetail } from '#lib/server/services/volunteer/cards-admin.ts';
import { publicUrl } from '#lib/server/storage/r2.ts';
import type { Actions, PageServerLoad } from './$types';

/* docs/05 section 28 "Cards": the card and the decision (admin); decisions — docs/todo.md 10.3 (1, 8). */
export const load: PageServerLoad = async ({ locals, params, setHeaders }) => {
	requirePermission(locals.user, 'volunteer.manage');
	setHeaders({ 'cache-control': 'no-store' });
	const card = await cardDetail(db, params.id);
	if (!card) error(404, 'Not found');
	const { avatarKey, ...member } = card.member;
	return {
		card: { ...card, member: { ...member, photoUrl: avatarKey ? publicUrl(avatarKey) : null } },
		checkUrl: card.publicToken ? cardCheckUrl(PUBLIC_SITE_URL ?? '', card.publicToken) : null
	};
};

const REFUSED: Record<'invalid' | 'bad_state', MessageKey> = {
	invalid: 'volunteerCards.error.reason',
	bad_state: 'volunteerCards.error.state'
};

async function decide(event: RequestEvent, action: CardDecisionInput['action']) {
	const actor = requirePermission(event.locals.user, 'volunteer.manage');
	const reason = String((await event.request.formData()).get('comment') ?? '');
	const input: CardDecisionInput = action === 'issue' ? { action } : { action, reason };
	const result = await decideCard(db, actor, event.params.id ?? '', input, {
		send: sendMail,
		siteUrl: PUBLIC_SITE_URL,
		ip: event.getClientAddress()
	});
	if (result.ok) return { done: true as const };
	if (result.reason === 'not_allowed') error(403, 'Forbidden');
	if (result.reason === 'not_found') error(404, 'Not found');
	if (result.reason === 'conditions') return fail(400, { missing: result.missing });
	return fail(400, { message: REFUSED[result.reason] });
}

export const actions: Actions = {
	issue: (event) => decide(event, 'issue'),
	reject: (event) => decide(event, 'reject'),
	revoke: (event) => decide(event, 'revoke')
};
