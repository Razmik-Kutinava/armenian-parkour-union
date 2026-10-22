import { error, fail, type RequestEvent } from '@sveltejs/kit';
import type { MessageKey } from '#lib/i18n/translate.ts';
import { requireUser } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { completeConsentUpload, signConsentUpload } from '#lib/server/services/consents/index.ts';
import { r2Private } from '#lib/server/storage/r2.ts';
import { StorageNotConfigured } from '#lib/server/storage/types.ts';
import { consentCompleteSchema, consentSignSchema } from '#lib/validation/consents.ts';

/* docs/06 section 5.10: the user id comes from the session only (docs/04 section 5.3). */

const refusals: Record<string, MessageKey> = {
	limited: 'cabinet.error.limited',
	kind_not_allowed: 'consents.error.kindNotAllowed',
	bad_key: 'consents.error.failed',
	missing: 'consents.error.missing',
	too_large: 'consents.error.size',
	bad_type: 'consents.error.type'
};

const refuse = (code: number, message: MessageKey) => fail(code, { consent: { message } });

/** No private bucket yet: a clear message instead of a 500. */
async function withStorage<T>(run: () => Promise<T>) {
	try {
		return await run();
	} catch (e) {
		if (e instanceof StorageNotConfigured) return refuse(400, 'consents.error.storage');
		throw e;
	}
}

const formOf = async (request: Request) => Object.fromEntries(await request.formData());

export const consentActions = {
	consentSign: async ({ locals, request }: RequestEvent) => {
		const user = requireUser(locals.user);
		const parsed = consentSignSchema.safeParse(await formOf(request));
		if (!parsed.success) return refuse(400, parsed.error.issues[0].message as MessageKey);
		return withStorage(async () => {
			const result = await signConsentUpload(db, r2Private, user.id, parsed.data);
			if (result === 'not_found') error(404);
			if (typeof result === 'string')
				return refuse(result === 'limited' ? 429 : 400, refusals[result]);
			return result;
		});
	},

	consentComplete: async ({ locals, request }: RequestEvent) => {
		const user = requireUser(locals.user);
		const parsed = consentCompleteSchema().safeParse(await formOf(request));
		if (!parsed.success) return refuse(400, parsed.error.issues[0].message as MessageKey);
		return withStorage(async () => {
			const result = await completeConsentUpload(db, r2Private, user.id, parsed.data);
			if (result === 'not_found') error(404);
			if (result !== 'ok') return refuse(400, refusals[result]);
			return { consent: { message: 'consents.sent' as MessageKey } };
		});
	}
};
