import { error, fail, type RequestEvent } from '@sveltejs/kit';
import type { MessageKey } from '#lib/i18n/translate.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import {
	completeLessonPdf,
	removeLessonPdf,
	signLessonPdf
} from '#lib/server/services/training/lesson-files.ts';
import { r2Private } from '#lib/server/storage/r2.ts';
import { StorageNotConfigured } from '#lib/server/storage/types.ts';
import { lessonPdfCompleteSchema, lessonPdfSignSchema } from '#lib/validation/training.ts';

type Event = RequestEvent<{ id: string; lessonId: string }>;

const MESSAGES: Record<string, MessageKey> = {
	bad_key: 'training.error.pdfFailed',
	missing: 'training.error.pdfMissing',
	too_large: 'training.error.pdfSize',
	bad_type: 'training.error.pdfType',
	no_file: 'training.error.noFile'
};

/** No bucket yet (decisions.md 2026-10-07): a clear message instead of a 500. */
async function withStorage<T>(run: () => Promise<T>) {
	try {
		return await run();
	} catch (e) {
		if (e instanceof StorageNotConfigured) {
			return fail(400, { message: 'training.error.storage' as MessageKey });
		}
		throw e;
	}
}

function refused(result: string) {
	if (result === 'not_found') error(404, 'Not found');
	if (result === 'not_allowed') error(403, 'Forbidden');
	return fail(400, { message: MESSAGES[result] ?? ('training.error.pdfFailed' as MessageKey) });
}

const fields = async (event: Event) => Object.fromEntries(await event.request.formData());

/** docs/05 section 27: signed link → PUT straight to the private bucket → the server checks the file. */
export const pdfActions = {
	pdfSign: async (event: Event) => {
		const actor = requirePermission(event.locals.user, 'training.lessons');
		const parsed = lessonPdfSignSchema.safeParse(await fields(event));
		if (!parsed.success) {
			return fail(400, { message: parsed.error.issues[0].message as MessageKey });
		}
		const { id, lessonId } = event.params;
		return withStorage(async () => {
			const result = await signLessonPdf(db, r2Private, actor, id, lessonId, parsed.data);
			return typeof result === 'string' ? refused(result) : result;
		});
	},
	pdfComplete: async (event: Event) => {
		const actor = requirePermission(event.locals.user, 'training.lessons');
		const parsed = lessonPdfCompleteSchema.safeParse(await fields(event));
		if (!parsed.success) return fail(400, { message: 'training.error.pdfFailed' as MessageKey });
		const { id, lessonId } = event.params;
		const ip = event.getClientAddress();
		return withStorage(async () => {
			const result = await completeLessonPdf(db, r2Private, actor, id, lessonId, parsed.data, ip);
			return result === 'ok' ? { pdf: 'done' as const } : refused(result);
		});
	},
	pdfRemove: async (event: Event) => {
		const actor = requirePermission(event.locals.user, 'training.lessons');
		const { id, lessonId } = event.params;
		const ip = event.getClientAddress();
		return withStorage(async () => {
			const result = await removeLessonPdf(db, r2Private, actor, id, lessonId, ip);
			return result === 'ok' ? { pdf: 'removed' as const } : refused(result);
		});
	}
};
