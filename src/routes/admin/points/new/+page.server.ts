import { fail } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { adjustPoints } from '#lib/server/services/points/adjust.ts';
import { findMember } from '#lib/server/services/points/member.ts';
import { adjustSchema, memberQuerySchema } from '#lib/validation/admin-points.ts';
import { fieldErrors, keepValues } from '#lib/validation/form.ts';
import { refusalMessage } from '../outcome';
import type { Actions, PageServerLoad } from './$types';

const FIELDS = ['delta', 'comment'] as const;

/* docs/05 section 12, docs/03 section 6.3: the member by email, then points with a comment. */
export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals.user, 'points.adjust');
	const email = url.searchParams.get('email') ?? '';
	const query = memberQuerySchema.safeParse({ email });
	const member = query.success ? await findMember(db, query.data.email) : null;
	return { email, member, searched: email !== '' };
};

export const actions: Actions = {
	default: async (event) => {
		const actor = requirePermission(event.locals.user, 'points.adjust');
		const form = await event.request.formData();
		const values = keepValues(form, FIELDS);
		const parsed = adjustSchema.safeParse(Object.fromEntries(form));
		if (!parsed.success) return fail(400, { values, errors: fieldErrors(parsed.error) });
		const result = await adjustPoints(db, actor, parsed.data, { ip: event.getClientAddress() });
		if (result.ok) {
			const before = result.balance - parsed.data.delta;
			return { done: { before, after: result.balance } };
		}
		const message = refusalMessage(result.reason);
		if (result.reason === 'insufficient_balance') {
			return fail(400, { values, errors: { delta: message } });
		}
		return fail(result.reason === 'not_found' ? 404 : 400, { values, message });
	}
};
