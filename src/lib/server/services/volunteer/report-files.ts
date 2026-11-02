import { and, eq, isNull } from 'drizzle-orm';
import { SNIFF_BYTES, sniffMime } from '#lib/validation/media.ts';
import {
	REPORT_MAX_BYTES,
	reportKey,
	reportMimeOfKey,
	type ReportMime,
	type ReportUploadRequest
} from '#lib/validation/volunteer-report.ts';
import { consume, limits, type LimitDb } from '../../auth/rate-limit';
import { users } from '../../db/schema/users';
import { StorageNotConfigured, type PrivateStorage } from '../../storage/types';
import { isUuid } from '../users/target';

/* docs/03 section 19.7 p. 2, 4: private bucket, type by signature, not public. */

export type SignReportResult = { key: string; url: string } | 'limited' | 'not_found';

async function memberExists(db: LimitDb, userId: string) {
	if (!isUuid(userId)) return false;
	const [row] = await db
		.select({ id: users.id })
		.from(users)
		.where(and(eq(users.id, userId), isNull(users.deletedAt)));
	return Boolean(row);
}

export async function signReportUpload(
	db: LimitDb,
	storage: PrivateStorage,
	userId: string,
	req: ReportUploadRequest
): Promise<SignReportResult> {
	if (!(await memberExists(db, userId))) return 'not_found';
	if (
		!(await consume(db, `volunteer-report:user:${userId}`, limits.volunteerReportUploadPerUser))
	) {
		return 'limited';
	}
	const key = reportKey(userId, req.mime);
	return { key, url: await storage.presignPut(key, req.mime, req.size) };
}

export type FileCheck =
	| { ok: true; key: string }
	| { ok: false; reason: 'bad_key' | 'missing' | 'too_large' | 'bad_type' };

/** Verifies an uploaded object; removes it on size/type failure. */
export async function checkReportFile(
	storage: PrivateStorage,
	userId: string,
	key: string
): Promise<FileCheck> {
	const expected = reportMimeOfKey(userId, key);
	if (!expected) return { ok: false, reason: 'bad_key' };
	const head = await storage.head(key);
	if (!head) return { ok: false, reason: 'missing' };
	const refuse = async (reason: 'too_large' | 'bad_type'): Promise<FileCheck> => {
		await storage.remove(key);
		return { ok: false, reason };
	};
	if (head.size > REPORT_MAX_BYTES) return refuse('too_large');
	if (head.size < 1) return refuse('bad_type');
	const sniffed = sniffMime(await storage.readStart(key, SNIFF_BYTES));
	if (sniffed !== expected) return refuse('bad_type');
	return { ok: true, key };
}

/** Admin view: 5-minute link; never exposes a foreign or public key. */
export async function reportFileLink(
	storage: PrivateStorage | null,
	ownerId: string,
	key: string | null
): Promise<string | null> {
	const mime = key ? reportMimeOfKey(ownerId, key) : null;
	if (!storage || !key || !mime) return null;
	try {
		return await storage.presignGet(key, mime);
	} catch (e) {
		if (e instanceof StorageNotConfigured) return null;
		throw e;
	}
}

export type { ReportMime };
