import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { CONSENT_MAX_BYTES } from '#lib/validation/consents.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { consents } from '../../db/schema/consents';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { fakeStorage } from '../media/fake-storage';
import { completeConsentUpload, signConsentUpload } from './files';
import { bornYearsAgo, insertConsent, PDF, PNG } from './test-support';

/* docs/06 section 5.10: the member uploads a scan or photo; rules — decisions.md 2026-10-22 (5.2). */

const AVIF = new Uint8Array([0, 0, 0, 0x1c, ...new TextEncoder().encode('ftypavif'), 0, 0, 0, 0]);
const HTML = new TextEncoder().encode('<html><script>alert(1)</script></html>');
const pdf = { kind: 'parental' as const, mime: 'application/pdf' as const, size: PDF.length };
const SIGNED_ON = '2026-10-01';

const rowsOf = (tx: LimitDb, userId: string) =>
	tx.select().from(consents).where(eq(consents.userId, userId)).orderBy(consents.createdAt);

async function minor(tx: LimitDb) {
	return insertUser(tx, { birthDate: bornYearsAgo(12), guardianName: 'Anna Petrosyan' });
}

async function upload(
	tx: LimitDb,
	storage: ReturnType<typeof fakeStorage>,
	userId: string,
	kind: 'parental' | 'medical' | 'privacy' = 'parental'
) {
	const signed = await signConsentUpload(tx, storage, userId, { ...pdf, kind });
	if (typeof signed === 'string') throw new Error(signed);
	storage.objects.set(signed.key, PDF);
	const done = await completeConsentUpload(tx, storage, userId, {
		kind,
		key: signed.key,
		signedOn: SIGNED_ON
	});
	return { key: signed.key, done };
}

describe.skipIf(!testDbUrl)('consents: member upload', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('signs a direct upload under the member`s own folder', async () => {
		await inRollback(async (tx) => {
			const user = await minor(tx);
			const result = await signConsentUpload(tx, fakeStorage(), user.id, pdf);
			if (typeof result === 'string') throw new Error(result);
			expect(result.key).toMatch(new RegExp(`^consents/${user.id}/[0-9a-f-]{36}\\.pdf$`));
			expect(result.url).toContain(result.key);
		});
	});

	it('a minor uploads any kind; an adult only the medical clearance', async () => {
		await inRollback(async (tx) => {
			const storage = fakeStorage();
			const child = await minor(tx);
			for (const kind of ['parental', 'medical', 'privacy'] as const) {
				expect(typeof (await signConsentUpload(tx, storage, child.id, { ...pdf, kind }))).toBe(
					'object'
				);
			}
			const adult = await insertUser(tx);
			for (const kind of ['parental', 'privacy'] as const) {
				expect(await signConsentUpload(tx, storage, adult.id, { ...pdf, kind })).toBe(
					'kind_not_allowed'
				);
			}
			const medical = { ...pdf, kind: 'medical' as const };
			expect(typeof (await signConsentUpload(tx, storage, adult.id, medical))).toBe('object');
		});
	});

	it('10 upload links an hour per member, then "limited"', async () => {
		await inRollback(async (tx) => {
			const storage = fakeStorage();
			const user = await minor(tx);
			for (let i = 0; i < 10; i++) await signConsentUpload(tx, storage, user.id, pdf);
			expect(await signConsentUpload(tx, storage, user.id, pdf)).toBe('limited');
		});
	});

	it('a deleted or unknown member gets nothing', async () => {
		await inRollback(async (tx) => {
			const storage = fakeStorage();
			const gone = await insertUser(tx, { deletedAt: new Date(), birthDate: bornYearsAgo(12) });
			expect(await signConsentUpload(tx, storage, gone.id, pdf)).toBe('not_found');
			expect(await signConsentUpload(tx, storage, 'nope', pdf)).toBe('not_found');
			const key = `consents/${gone.id}/${crypto.randomUUID()}.pdf`;
			storage.objects.set(key, PDF);
			const input = { kind: 'parental' as const, key, signedOn: SIGNED_ON };
			expect(await completeConsentUpload(tx, storage, gone.id, input)).toBe('not_found');
		});
	});

	it('complete: a pending consent with the signing day and the parent from the profile', async () => {
		await inRollback(async (tx) => {
			const storage = fakeStorage();
			const user = await minor(tx);
			const { key, done } = await upload(tx, storage, user.id);
			expect(done).toBe('ok');
			const [row] = await rowsOf(tx, user.id);
			expect(row).toMatchObject({
				kind: 'parental',
				status: 'pending',
				fileKey: key,
				guardianName: 'Anna Petrosyan',
				reviewedBy: null,
				validUntil: null
			});
			expect(row.signedAt?.toISOString()).toBe('2026-09-30T20:00:00.000Z');
			const medical = await upload(tx, storage, user.id, 'medical');
			expect(medical.done).toBe('ok');
			expect((await rowsOf(tx, user.id))[1].guardianName).toBeNull();
		});
	});

	it('another member`s key, an avatar or a library key cannot be claimed', async () => {
		await inRollback(async (tx) => {
			const storage = fakeStorage();
			const user = await minor(tx);
			const victim = await minor(tx);
			const keys = [
				`consents/${victim.id}/${crypto.randomUUID()}.pdf`,
				`avatars/${user.id}/${crypto.randomUUID()}.png`,
				`media/2026/10/${crypto.randomUUID()}.pdf`
			];
			for (const key of keys) {
				storage.objects.set(key, PDF);
				const input = { kind: 'parental' as const, key, signedOn: SIGNED_ON };
				expect(await completeConsentUpload(tx, storage, user.id, input)).toBe('bad_key');
				expect(storage.objects.has(key)).toBe(true);
			}
			expect(await rowsOf(tx, user.id)).toHaveLength(0);
		});
	});

	it('not uploaded — "missing"; too large or not the declared type — removed', async () => {
		await inRollback(async (tx) => {
			const storage = fakeStorage();
			const user = await minor(tx);
			const signed = await signConsentUpload(tx, storage, user.id, pdf);
			if (typeof signed === 'string') throw new Error(signed);
			const input = { kind: 'parental' as const, key: signed.key, signedOn: SIGNED_ON };
			expect(await completeConsentUpload(tx, storage, user.id, input)).toBe('missing');
			const big = new Uint8Array(CONSENT_MAX_BYTES + 1);
			big.set(PDF);
			const cases = [
				[big, 'too_large'],
				[new Uint8Array(), 'bad_type'],
				[HTML, 'bad_type'],
				[PNG, 'bad_type'],
				[AVIF, 'bad_type']
			] as const;
			for (const [body, reason] of cases) {
				storage.objects.set(signed.key, body);
				expect(await completeConsentUpload(tx, storage, user.id, input)).toBe(reason);
				expect(storage.objects.has(signed.key)).toBe(false);
			}
			expect(await rowsOf(tx, user.id)).toHaveLength(0);
		});
	});

	it('an adult cannot complete a parental consent either', async () => {
		await inRollback(async (tx) => {
			const storage = fakeStorage();
			const adult = await insertUser(tx);
			const key = `consents/${adult.id}/${crypto.randomUUID()}.pdf`;
			storage.objects.set(key, PDF);
			const input = { kind: 'parental' as const, key, signedOn: SIGNED_ON };
			expect(await completeConsentUpload(tx, storage, adult.id, input)).toBe('kind_not_allowed');
			expect(await rowsOf(tx, adult.id)).toHaveLength(0);
		});
	});

	it('a new file while one is pending replaces it; the old object is removed', async () => {
		await inRollback(async (tx) => {
			const storage = fakeStorage();
			const user = await minor(tx);
			const first = await upload(tx, storage, user.id);
			const second = await upload(tx, storage, user.id);
			expect(second.done).toBe('ok');
			const rows = await rowsOf(tx, user.id);
			expect(rows).toHaveLength(1);
			expect(rows[0].fileKey).toBe(second.key);
			expect(storage.objects.has(first.key)).toBe(false);
			expect(storage.objects.has(second.key)).toBe(true);
		});
	});

	it('after a decision a new file is a new consent; the approved one stays', async () => {
		await inRollback(async (tx) => {
			const storage = fakeStorage();
			const user = await minor(tx);
			const approved = await insertConsent(tx, user.id, { status: 'approved' });
			storage.objects.set(approved.fileKey!, PNG);
			const next = await upload(tx, storage, user.id);
			expect(next.done).toBe('ok');
			const rows = await rowsOf(tx, user.id);
			expect(rows.map((r) => r.status)).toEqual(['approved', 'pending']);
			expect(storage.objects.has(approved.fileKey!)).toBe(true);
		});
	});
});
