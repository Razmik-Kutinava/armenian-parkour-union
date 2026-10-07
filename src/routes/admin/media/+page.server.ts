import { error, fail } from '@sveltejs/kit';
import { readListState } from '#lib/components/admin/list-state.ts';
import type { MessageKey } from '#lib/i18n/translate.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { listMedia, mediaListOptions } from '#lib/server/services/media/list.ts';
import { completeUpload, signUpload } from '#lib/server/services/media/upload.ts';
import { publicUrl, r2 } from '#lib/server/storage/r2.ts';
import { StorageNotConfigured } from '#lib/server/storage/types.ts';
import { completeSchema, uploadRequestSchema } from '#lib/validation/media.ts';
import type { Actions, PageServerLoad } from './$types';

const refusals: Record<string, MessageKey> = {
	bad_key: 'media.error.failed',
	missing: 'media.error.missing',
	too_large: 'media.error.size',
	bad_type: 'media.error.type'
};

/** No bucket yet (decisions.md 2026-10-07): a clear message instead of a 500. */
async function withStorage<T>(run: () => Promise<T>) {
	try {
		return await run();
	} catch (e) {
		if (e instanceof StorageNotConfigured) {
			return fail(400, { message: 'media.error.storage' as MessageKey });
		}
		throw e;
	}
}

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals.user, 'media.write');
	const state = readListState(url.searchParams, mediaListOptions);
	const { rows, total } = await listMedia(db, state);
	return { state, total, rows: rows.map((r) => ({ ...r, url: publicUrl(r.key) })) };
};

export const actions: Actions = {
	sign: async (event) => {
		const actor = requirePermission(event.locals.user, 'media.write');
		const parsed = uploadRequestSchema.safeParse(
			Object.fromEntries(await event.request.formData())
		);
		if (!parsed.success) {
			return fail(400, { message: parsed.error.issues[0].message as MessageKey });
		}
		return withStorage(async () => {
			const result = await signUpload(r2, actor, parsed.data);
			if (result === 'not_allowed') error(403, 'Forbidden');
			return result;
		});
	},
	complete: async (event) => {
		const actor = requirePermission(event.locals.user, 'media.write');
		const parsed = completeSchema.safeParse(Object.fromEntries(await event.request.formData()));
		if (!parsed.success) return fail(400, { message: 'media.error.failed' as MessageKey });
		return withStorage(async () => {
			const ip = event.getClientAddress();
			const result = await completeUpload(db, r2, actor, parsed.data, ip);
			if (result === 'not_allowed') error(403, 'Forbidden');
			if (typeof result === 'string') return fail(400, { message: refusals[result] });
			return { id: result.id };
		});
	}
};
