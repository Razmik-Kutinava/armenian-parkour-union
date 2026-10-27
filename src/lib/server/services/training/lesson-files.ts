import { eq } from 'drizzle-orm';
import { SNIFF_BYTES, sniffMime } from '#lib/validation/media.ts';
import {
	isLessonPdfKey,
	LESSON_PDF_MAX_BYTES,
	lessonPdfKey,
	type LessonPdfComplete,
	type LessonPdfSign
} from '#lib/validation/training.ts';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { courseLessons } from '../../db/schema/training';
import { StorageNotConfigured, type PrivateStorage, type Storage } from '../../storage/types';
import { writeAudit } from '../audit';
import type { Actor } from '../users/target';
import { getLesson } from './lesson-list';
import { lockLesson } from './lessons';

/* docs/05 section 27: signed link → PUT to the private bucket → the server checks the object, as for
 * consents; decisions — docs/todo.md 9.2 (6). */

type Refusal = 'not_allowed' | 'not_found';
export type LessonPdfCompleteResult =
	'ok' | Refusal | 'bad_key' | 'missing' | 'too_large' | 'bad_type';

const PDF = 'application/pdf';

/** After the commit: a failed removal leaves an orphan object, not a broken lesson. */
async function removeQuietly(storage: Storage, key: string) {
	await storage.remove(key).catch((e) => console.warn(`lesson PDF ${key}: not removed`, e));
}

export async function signLessonPdf(
	db: LimitDb,
	storage: Storage,
	actor: Actor,
	courseId: string,
	lessonId: string,
	req: LessonPdfSign
): Promise<{ key: string; url: string } | Refusal> {
	if (!roleCan(actor.role, 'training.lessons')) return 'not_allowed';
	if (!(await getLesson(db, courseId, lessonId))) return 'not_found';
	const key = lessonPdfKey(courseId);
	return { key, url: await storage.presignPut(key, req.mime, req.size) };
}

/**
 * Attaches the file (or detaches with `null`) in one transaction with its log entry; returns the key
 * it replaced, `undefined` for no lesson and `false` when there is nothing to detach.
 */
async function attach(
	db: LimitDb,
	actor: Actor,
	courseId: string,
	lessonId: string,
	file: LessonPdfComplete | null,
	ip: string | null
) {
	return db.transaction(async (tx) => {
		const lesson = await lockLesson(tx, courseId, lessonId);
		if (!lesson) return undefined;
		if (!file && !lesson.fileKey) return false as const;
		await tx
			.update(courseLessons)
			.set({ fileKey: file?.key ?? null, fileName: file?.name ?? null })
			.where(eq(courseLessons.id, lesson.id));
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'course_lesson.update',
			entityType: 'course_lesson',
			entityId: lesson.id,
			before: { file: lesson.fileName },
			after: { file: file?.name ?? null },
			ip
		});
		return lesson.fileKey;
	});
}

export async function completeLessonPdf(
	db: LimitDb,
	storage: Storage,
	actor: Actor,
	courseId: string,
	lessonId: string,
	req: LessonPdfComplete,
	ip: string | null
): Promise<LessonPdfCompleteResult> {
	if (!roleCan(actor.role, 'training.lessons')) return 'not_allowed';
	if (!(await getLesson(db, courseId, lessonId))) return 'not_found';
	if (!isLessonPdfKey(courseId, req.key)) return 'bad_key';
	const head = await storage.head(req.key);
	if (!head) return 'missing';
	const refuse = async (reason: 'too_large' | 'bad_type') => {
		await storage.remove(req.key);
		return reason;
	};
	if (head.size > LESSON_PDF_MAX_BYTES) return refuse('too_large');
	if (head.size < 1) return refuse('bad_type');
	if (sniffMime(await storage.readStart(req.key, SNIFF_BYTES)) !== PDF) return refuse('bad_type');

	const old = await attach(db, actor, courseId, lessonId, req, ip);
	if (old === undefined || old === false) {
		await removeQuietly(storage, req.key);
		return 'not_found';
	}
	if (old && old !== req.key) await removeQuietly(storage, old);
	return 'ok';
}

export async function removeLessonPdf(
	db: LimitDb,
	storage: Storage,
	actor: Actor,
	courseId: string,
	lessonId: string,
	ip: string | null
): Promise<'ok' | 'no_file' | Refusal> {
	if (!roleCan(actor.role, 'training.lessons')) return 'not_allowed';
	const old = await attach(db, actor, courseId, lessonId, null, ip);
	if (old === undefined) return 'not_found';
	if (old === false) return 'no_file';
	if (old) await removeQuietly(storage, old);
	return 'ok';
}

/** A 5-minute link to the lesson PDF; none without the bucket. */
export async function lessonPdfLink(
	storage: PrivateStorage,
	key: string | null
): Promise<string | null> {
	if (!key) return null;
	try {
		return await storage.presignGet(key, PDF);
	} catch (e) {
		if (e instanceof StorageNotConfigured) return null;
		throw e;
	}
}
