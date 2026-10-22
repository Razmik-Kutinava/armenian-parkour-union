import { error, fail, type RequestEvent } from '@sveltejs/kit';
import type { MessageKey } from '#lib/i18n/translate.ts';
import { requireUser } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import {
	completeAvatarUpload,
	removeAvatar,
	signAvatarUpload
} from '#lib/server/services/cabinet/avatar.ts';
import { r2 } from '#lib/server/storage/r2.ts';
import { StorageNotConfigured } from '#lib/server/storage/types.ts';
import { avatarRequestSchema } from '#lib/validation/avatar.ts';

/* docs/06 section 5.2 "photo": the user id comes from the session only (docs/04 section 5.3). */

const refusals: Record<string, MessageKey> = {
	limited: 'cabinet.error.limited',
	bad_key: 'cabinet.avatar.failed',
	missing: 'cabinet.avatar.missing',
	too_large: 'cabinet.avatar.size',
	bad_type: 'cabinet.avatar.type'
};

const refuse = (code: number, message: MessageKey) => fail(code, { avatar: { message } });

/** No bucket yet: a clear message instead of a 500. */
async function withStorage<T>(run: () => Promise<T>) {
	try {
		return await run();
	} catch (e) {
		if (e instanceof StorageNotConfigured) return refuse(400, 'cabinet.avatar.storage');
		throw e;
	}
}

export const avatarActions = {
	avatarSign: async ({ locals, request }: RequestEvent) => {
		const user = requireUser(locals.user);
		const parsed = avatarRequestSchema.safeParse(Object.fromEntries(await request.formData()));
		if (!parsed.success) return refuse(400, parsed.error.issues[0].message as MessageKey);
		return withStorage(async () => {
			const result = await signAvatarUpload(db, r2, user.id, parsed.data);
			if (result === 'not_found') error(404);
			if (result === 'limited') return refuse(429, refusals.limited);
			return result;
		});
	},

	avatarComplete: async ({ locals, request }: RequestEvent) => {
		const user = requireUser(locals.user);
		const key = String((await request.formData()).get('key') ?? '').slice(0, 200);
		return withStorage(async () => {
			const result = await completeAvatarUpload(db, r2, user.id, key);
			if (result === 'not_found') error(404);
			if (result !== 'ok') return refuse(400, refusals[result]);
			return { avatar: { message: 'cabinet.avatar.saved' as MessageKey } };
		});
	},

	avatarRemove: async ({ locals }: RequestEvent) => {
		const user = requireUser(locals.user);
		return withStorage(async () => {
			if ((await removeAvatar(db, r2, user.id)) === 'not_found') error(404);
			return { avatar: { message: 'cabinet.avatar.removed' as MessageKey } };
		});
	}
};
