import { fail } from '@sveltejs/kit';
import { PUBLIC_SITE_URL } from '$app/env/private';
import type { MessageKey } from '#lib/i18n/translate.ts';
import { requireUser } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { sendMail } from '#lib/server/mail/index.ts';
import { applyForCard } from '#lib/server/services/volunteer/card-apply.ts';
import { ownCard } from '#lib/server/services/volunteer/card-own.ts';
import type { Actions, PageServerLoad } from './$types';

/* docs/06 section 5.12 "Card": the member's own card only — the id comes from the session. */

export const load: PageServerLoad = async ({ locals, setHeaders }) => {
	const user = requireUser(locals.user);
	setHeaders({ 'cache-control': 'no-store' });
	return { own: await ownCard(db, user.id) };
};

const REFUSED: Record<'not_found' | 'blocked' | 'bad_state' | 'conditions', MessageKey> = {
	not_found: 'cabinet.volunteer.error.gone',
	blocked: 'cabinet.volunteer.error.blocked',
	bad_state: 'cabinet.volunteer.error.state',
	conditions: 'cabinet.volunteer.error.conditions'
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
	}
};
