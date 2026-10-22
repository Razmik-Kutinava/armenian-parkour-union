import { and, eq, isNull, sql } from 'drizzle-orm';
import {
	CONSENT_MAX_BYTES,
	consentKey,
	consentMimeOfKey,
	startOfYerevanDay,
	type ConsentCompleteRequest,
	type ConsentSignRequest
} from '#lib/validation/consents.ts';
import { SNIFF_BYTES, sniffMime } from '#lib/validation/media.ts';
import { consume, limits, type LimitDb } from '../../auth/rate-limit';
import { consents } from '../../db/schema/consents';
import { users } from '../../db/schema/users';
import { StorageNotConfigured, type PrivateStorage, type Storage } from '../../storage/types';
import { isUuid } from '../users/target';
import { kindsFor } from './valid';

/* docs/06 section 5.10: signed link → PUT to the private bucket → the server checks the object,
 * as for the profile photo; rules — decisions.md 2026-10-22 (5.2). */

export type ConsentSignResult =
	{ key: string; url: string } | 'limited' | 'not_found' | 'kind_not_allowed';
export type ConsentCompleteResult =
	'ok' | 'not_found' | 'kind_not_allowed' | 'bad_key' | 'missing' | 'too_large' | 'bad_type';

async function member(db: LimitDb, userId: string) {
	if (!isUuid(userId)) return null;
	const [row] = await db
		.select({ birthDate: users.birthDate, guardianName: users.guardianName })
		.from(users)
		.where(and(eq(users.id, userId), isNull(users.deletedAt)));
	return row ?? null;
}

export async function signConsentUpload(
	db: LimitDb,
	storage: Storage,
	userId: string,
	req: ConsentSignRequest,
	now = new Date()
): Promise<ConsentSignResult> {
	const m = await member(db, userId);
	if (!m) return 'not_found';
	if (!kindsFor(m.birthDate, now).includes(req.kind)) return 'kind_not_allowed';
	if (!(await consume(db, `consent-upload:user:${userId}`, limits.consentUploadPerUser))) {
		return 'limited';
	}
	const key = consentKey(userId, req.mime);
	return { key, url: await storage.presignPut(key, req.mime, req.size) };
}

/**
 * A pending consent of the kind takes the new file (returns the key it replaced); otherwise a new
 * pending consent. The member row lock keeps two uploads from making two pending consents.
 */
async function save(
	db: LimitDb,
	userId: string,
	req: ConsentCompleteRequest,
	guardianName: string | null
) {
	return db.transaction(async (tx) => {
		const [locked] = await tx
			.select({ id: users.id })
			.from(users)
			.where(and(eq(users.id, userId), isNull(users.deletedAt)))
			.for('update');
		if (!locked) return undefined;
		const values = {
			fileKey: req.key,
			signedAt: startOfYerevanDay(req.signedOn),
			guardianName: req.kind === 'medical' ? null : guardianName
		};
		const [pending] = await tx
			.select({ id: consents.id, fileKey: consents.fileKey })
			.from(consents)
			.where(
				and(
					eq(consents.userId, userId),
					eq(consents.kind, req.kind),
					eq(consents.status, 'pending')
				)
			)
			.for('update');
		if (pending) {
			await tx.update(consents).set(values).where(eq(consents.id, pending.id));
			return pending.fileKey;
		}
		await tx
			.insert(consents)
			.values({ ...values, userId, kind: req.kind, createdAt: sql`clock_timestamp()` });
		return null;
	});
}

export async function completeConsentUpload(
	db: LimitDb,
	storage: Storage,
	userId: string,
	req: ConsentCompleteRequest,
	now = new Date()
): Promise<ConsentCompleteResult> {
	const m = await member(db, userId);
	if (!m) return 'not_found';
	if (!kindsFor(m.birthDate, now).includes(req.kind)) return 'kind_not_allowed';
	const expected = consentMimeOfKey(userId, req.key);
	if (!expected) return 'bad_key';
	const head = await storage.head(req.key);
	if (!head) return 'missing';
	const refuse = async (reason: 'too_large' | 'bad_type') => {
		await storage.remove(req.key);
		return reason;
	};
	if (head.size > CONSENT_MAX_BYTES) return refuse('too_large');
	if (head.size < 1) return refuse('bad_type');
	const sniffed = sniffMime(await storage.readStart(req.key, SNIFF_BYTES));
	if (sniffed !== expected) return refuse('bad_type');

	const old = await save(db, userId, req, m.guardianName);
	if (old === undefined) return 'not_found';
	if (old && old !== req.key && consentMimeOfKey(userId, old)) {
		await storage.remove(old).catch((e) => console.warn(`consent ${old}: not removed`, e));
	}
	return 'ok';
}

/** A 5-minute link to the member's own file; none without the bucket or for a foreign key. */
export async function fileLink(
	storage: PrivateStorage | null,
	userId: string,
	key: string | null
): Promise<string | null> {
	const mime = key ? consentMimeOfKey(userId, key) : null;
	if (!storage || !key || !mime) return null;
	try {
		return await storage.presignGet(key, mime);
	} catch (e) {
		if (e instanceof StorageNotConfigured) return null;
		throw e;
	}
}
