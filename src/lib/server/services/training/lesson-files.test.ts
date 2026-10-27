import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { LESSON_PDF_MAX_BYTES } from '#lib/validation/training.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { courseLessons } from '../../db/schema/training';
import { testDb, testDbUrl } from '../../db/test-db';
import { StorageNotConfigured } from '../../storage/types';
import { fakeStorage } from '../media/fake-storage';
import { completeLessonPdf, lessonPdfLink, removeLessonPdf, signLessonPdf } from './lesson-files';
import { auditOf, insertCourse, IP, PDF, staff } from './test-support';

/* docs/05 section 27 "Lessons": PDF in the private bucket, type by signature; decisions — todo 9.2 (6). */

type Actor = { id: string; role: 'admin' | 'editor' | 'moderator' | 'member' };
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
const pdf = { mime: 'application/pdf' as const, size: PDF.length };

async function setup(tx: LimitDb, role: Actor['role'] = 'editor') {
	const actor = (await staff(tx, role)) as Actor;
	const courseId = await insertCourse(tx);
	const [row] = await tx
		.insert(courseLessons)
		.values({ courseId, title: { en: 'Lesson' } })
		.returning({ id: courseLessons.id });
	return { actor, courseId, lessonId: row.id, storage: fakeStorage() };
}

async function upload(tx: LimitDb, s: Awaited<ReturnType<typeof setup>>, body = PDF) {
	const signed = await signLessonPdf(tx, s.storage, s.actor, s.courseId, s.lessonId, pdf);
	if (typeof signed === 'string') throw new Error(signed);
	s.storage.objects.set(signed.key, body);
	const done = await completeLessonPdf(
		tx,
		s.storage,
		s.actor,
		s.courseId,
		s.lessonId,
		{
			key: signed.key,
			name: 'safety.pdf'
		},
		IP
	);
	return { key: signed.key, done };
}

const stored = async (tx: LimitDb, id: string) =>
	(await tx.select().from(courseLessons).where(eq(courseLessons.id, id)))[0];

describe.skipIf(!testDbUrl)('training: lesson PDF', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('signs an upload in the course folder; the checked PDF is attached and logged', async () => {
		await inRollback(async (tx) => {
			const s = await setup(tx);
			const { key, done } = await upload(tx, s);
			expect(key).toMatch(new RegExp(`^training/${s.courseId}/[0-9a-f-]{36}\\.pdf$`));
			expect(done).toBe('ok');
			expect(await stored(tx, s.lessonId)).toMatchObject({ fileKey: key, fileName: 'safety.pdf' });
			const [entry] = await auditOf(tx, 'course_lesson', s.lessonId);
			expect(entry).toMatchObject({ action: 'course_lesson.update', actorId: s.actor.id, ip: IP });
			expect(entry.after).toEqual({ file: 'safety.pdf' });
		});
	});

	it('a new PDF replaces the old one, which leaves the bucket', async () => {
		await inRollback(async (tx) => {
			const s = await setup(tx);
			const first = await upload(tx, s);
			const second = await upload(tx, s);
			expect(second.done).toBe('ok');
			expect((await stored(tx, s.lessonId)).fileKey).toBe(second.key);
			expect(s.storage.objects.has(first.key)).toBe(false);
		});
	});

	it('not a PDF, too large, missing or a foreign key: refused, the object removed', async () => {
		await inRollback(async (tx) => {
			const s = await setup(tx);
			expect((await upload(tx, s, PNG)).done).toBe('bad_type');
			const big = new Uint8Array(LESSON_PDF_MAX_BYTES + 1);
			big.set(PDF);
			const large = await upload(tx, s, big);
			expect(large.done).toBe('too_large');
			expect(s.storage.objects.has(large.key)).toBe(false);
			const complete = (key: string) =>
				completeLessonPdf(
					tx,
					s.storage,
					s.actor,
					s.courseId,
					s.lessonId,
					{ key, name: 'a.pdf' },
					IP
				);
			expect(await complete(`training/${s.courseId}/${crypto.randomUUID()}.pdf`)).toBe('missing');
			const foreign = `training/${crypto.randomUUID()}/${crypto.randomUUID()}.pdf`;
			s.storage.objects.set(foreign, PDF);
			expect(await complete(foreign)).toBe('bad_key');
			expect(s.storage.objects.has(foreign)).toBe(true);
			expect((await stored(tx, s.lessonId)).fileKey).toBeNull();
		});
	});

	it('remove detaches the file, logs it and deletes the object; no file — refused', async () => {
		await inRollback(async (tx) => {
			const s = await setup(tx);
			const { key } = await upload(tx, s);
			expect(await removeLessonPdf(tx, s.storage, s.actor, s.courseId, s.lessonId, IP)).toBe('ok');
			expect(await stored(tx, s.lessonId)).toMatchObject({ fileKey: null, fileName: null });
			expect(s.storage.objects.has(key)).toBe(false);
			expect((await auditOf(tx, 'course_lesson', s.lessonId)).at(-1)?.after).toEqual({
				file: null
			});
			expect(await removeLessonPdf(tx, s.storage, s.actor, s.courseId, s.lessonId, IP)).toBe(
				'no_file'
			);
		});
	});

	it('a moderator or member may not; a deleted lesson or another course is not found', async () => {
		await inRollback(async (tx) => {
			const s = await setup(tx);
			for (const role of ['moderator', 'member'] as const) {
				const actor = await staff(tx, role);
				expect(await signLessonPdf(tx, s.storage, actor, s.courseId, s.lessonId, pdf)).toBe(
					'not_allowed'
				);
				expect(await removeLessonPdf(tx, s.storage, actor, s.courseId, s.lessonId, IP)).toBe(
					'not_allowed'
				);
			}
			const other = await insertCourse(tx);
			expect(await signLessonPdf(tx, s.storage, s.actor, other, s.lessonId, pdf)).toBe('not_found');
			await tx
				.update(courseLessons)
				.set({ deletedAt: new Date() })
				.where(eq(courseLessons.id, s.lessonId));
			expect(await signLessonPdf(tx, s.storage, s.actor, s.courseId, s.lessonId, pdf)).toBe(
				'not_found'
			);
		});
	});

	it('the view link is short-lived; no bucket — no link instead of an error', async () => {
		const key = `training/${crypto.randomUUID()}/${crypto.randomUUID()}.pdf`;
		expect(await lessonPdfLink(fakeStorage(), key)).toContain(key);
		const broken = {
			...fakeStorage(),
			presignGet: async () => {
				throw new StorageNotConfigured('no bucket');
			}
		};
		expect(await lessonPdfLink(broken, key)).toBeNull();
		expect(await lessonPdfLink(fakeStorage(), null)).toBeNull();
	});
});
