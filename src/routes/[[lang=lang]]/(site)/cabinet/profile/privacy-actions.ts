import { error, type RequestEvent } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth/guard.ts';
import { publicCache } from '#lib/server/cache/index.ts';
import { db } from '#lib/server/db/index.ts';
import { cancelOwnDeletion, requestOwnDeletion } from '#lib/server/services/cabinet/deletion.ts';
import { updateOwnPrivacy } from '#lib/server/services/cabinet/privacy.ts';

/* docs/06 section 5.2 "Privacy" and the deletion request: the user id comes from the session only
 * (docs/04 section 5.3). Unchecked boxes are not sent, so "absent" means off. */

export const privacyActions = {
	privacy: async ({ locals, request }: RequestEvent) => {
		const user = requireUser(locals.user);
		const form = await request.formData();
		const privacy = { showCity: form.has('showCity'), showAvatar: form.has('showAvatar') };
		if ((await updateOwnPrivacy(db, user.id, privacy)) === 'not_found') error(404);
		/* a hero person or a team card may show the photo: a withdrawn consent applies at once */
		publicCache.invalidate(['hero', 'staff']);
		return { privacy: { saved: true } };
	},

	deletionRequest: async ({ locals, getClientAddress }: RequestEvent) => {
		const user = requireUser(locals.user);
		if ((await requestOwnDeletion(db, user.id, getClientAddress())) === 'not_found') error(404);
		return { deletion: { cancelled: false } };
	},

	deletionCancel: async ({ locals, getClientAddress }: RequestEvent) => {
		const user = requireUser(locals.user);
		if ((await cancelOwnDeletion(db, user.id, getClientAddress())) === 'not_found') error(404);
		return { deletion: { cancelled: true } };
	}
};
