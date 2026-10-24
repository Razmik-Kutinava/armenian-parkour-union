import { error, fail } from '@sveltejs/kit';
import { pickLocalized, type LocalizedText } from '#lib/i18n/localized.ts';
import type { MessageKey } from '#lib/i18n/translate.ts';
import { requireUser } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { getMembershipOverview } from '#lib/server/services/memberships/overview.ts';
import { videoEventOptions } from '#lib/server/services/videos/events.ts';
import { ownVideos } from '#lib/server/services/videos/own.ts';
import { videoSettings } from '#lib/server/services/videos/settings.ts';
import { addVideo, type AddVideoRefusal } from '#lib/server/services/videos/submit.ts';
import { fieldErrors, keepValues } from '#lib/validation/form.ts';
import { videoFormSchema } from '#lib/validation/videos.ts';
import type { Actions, PageServerLoad } from './$types';

/* docs/06 section 5.7, docs/04 section 7: own videos only, adding needs an active membership. */

const FIELDS = ['url', 'title', 'eventId'] as const;

const REFUSALS: Record<Exclude<AddVideoRefusal, 'not_found'>, [string, MessageKey]> = {
	no_membership: ['form', 'videos.error.membership'],
	platform: ['url', 'videos.error.platform'],
	duplicate: ['url', 'videos.error.duplicate'],
	limit: ['form', 'videos.error.limit'],
	event: ['eventId', 'videos.error.event']
};

export const load: PageServerLoad = async ({ locals, setHeaders }) => {
	const user = requireUser(locals.user);
	setHeaders({ 'cache-control': 'no-store' });
	const [videos, membership, events, settings] = await Promise.all([
		ownVideos(db, user.id),
		getMembershipOverview(db, user.id),
		videoEventOptions(db),
		videoSettings(db)
	]);
	return {
		videos,
		canAdd: membership.active,
		events: events.map((e) => ({
			value: e.id,
			label: pickLocalized(e.title as LocalizedText, locals.locale)
		})),
		settings
	};
};

export const actions: Actions = {
	add: async ({ locals, request }) => {
		const user = requireUser(locals.user);
		const form = await request.formData();
		const values = keepValues(form, FIELDS);
		const parsed = videoFormSchema.safeParse(Object.fromEntries(form));
		if (!parsed.success) return fail(400, { add: { errors: fieldErrors(parsed.error), values } });
		const result = await addVideo(db, user.id, parsed.data, await videoSettings(db));
		if (!result.ok) {
			if (result.reason === 'not_found') error(404);
			const [field, message] = REFUSALS[result.reason];
			return fail(400, { add: { errors: { [field]: message }, values } });
		}
		return { add: { added: true } };
	}
};
