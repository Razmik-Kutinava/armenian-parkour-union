import { eq } from 'drizzle-orm';
import {
	MEDIA_MAX_BYTES,
	SNIFF_BYTES,
	mediaKey,
	mimeOfKey,
	sniffMime,
	type UploadRequest
} from '#lib/validation/media.ts';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { media } from '../../db/schema/service';
import type { Storage } from '../../storage/types';
import { writeAudit } from '../audit';
import type { Actor } from '../users/target';

export type SignResult = { key: string; url: string } | 'not_allowed';
export type CompleteResult =
	{ id: string } | 'not_allowed' | 'bad_key' | 'missing' | 'too_large' | 'bad_type';

/** Step 1 of docs/05 section 20 upload: a fresh key and a signed direct-upload link. */
export async function signUpload(
	storage: Storage,
	actor: Actor,
	req: UploadRequest
): Promise<SignResult> {
	if (!roleCan(actor.role, 'media.write')) return 'not_allowed';
	const key = mediaKey(req.mime);
	return { key, url: await storage.presignPut(key, req.mime, req.size) };
}

/**
 * Step 3: the object in the bucket is checked itself (size, real type by its first bytes), so a
 * forged request or a swapped file never enters the library; a refused object is removed.
 */
export async function completeUpload(
	db: LimitDb,
	storage: Storage,
	actor: Actor,
	input: { key: string; name: string },
	ip: string | null
): Promise<CompleteResult> {
	if (!roleCan(actor.role, 'media.write')) return 'not_allowed';
	const expected = mimeOfKey(input.key);
	if (!expected) return 'bad_key';
	const [taken] = await db
		.select({ id: media.id })
		.from(media)
		.where(eq(media.key, input.key))
		.limit(1);
	if (taken) return 'bad_key';

	const head = await storage.head(input.key);
	if (!head) return 'missing';
	const refuse = async (reason: 'too_large' | 'bad_type') => {
		await storage.remove(input.key);
		return reason;
	};
	if (head.size > MEDIA_MAX_BYTES) return refuse('too_large');
	if (head.size < 1) return refuse('bad_type');
	if (sniffMime(await storage.readStart(input.key, SNIFF_BYTES)) !== expected) {
		return refuse('bad_type');
	}

	return db.transaction(async (tx) => {
		const [row] = await tx
			.insert(media)
			.values({
				key: input.key,
				originalName: input.name,
				mime: expected,
				sizeBytes: head.size,
				uploadedBy: actor.id
			})
			.onConflictDoNothing({ target: media.key })
			.returning({ id: media.id });
		if (!row) return 'bad_key' as const;
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'media.upload',
			entityType: 'media',
			entityId: row.id,
			after: { key: input.key, name: input.name, mime: expected, size: head.size },
			ip
		});
		return { id: row.id };
	});
}
