import { afterAll, describe, expect, it } from 'vitest';
import { testDb, testDbUrl } from '../../db/test-db';
import type { Mail } from '../../mail/resend';
import { StorageNotConfigured } from '../../storage/types';
import { fakeStorage } from '../media/fake-storage';
import { auditFor } from '../memberships/test-support';
import { insertMember } from '../registrations/test-support';
import { issueCertificate } from './issue';
import { certificatePdfKey, regenerateCertificatePdf, storeCertificatePdf } from './pdf-store';
import {
	SETTINGS,
	TEST_IMAGES,
	certRow,
	insertCertificate,
	insertStaff,
	passedExam
} from './test-support';

/* docs/03 section 4 p. 5, docs/05 section 8: the PDF is made on the server after the issue, kept in
 * the private bucket (`file_key`), made again on request; a revoked certificate is not remade. */

const deps = (storage = fakeStorage(), images: typeof TEST_IMAGES | null = TEST_IMAGES) => ({
	storage,
	images: async () => images,
	settings: SETTINGS,
	siteUrl: 'https://parkour.test'
});

const isPdf = (bytes: Uint8Array | undefined) =>
	!!bytes && Buffer.from(bytes.slice(0, 5)).toString('latin1') === '%PDF-';

describe.skipIf(!testDbUrl)('certificates: PDF storage', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	async function certificate(
		tx: Parameters<Parameters<typeof inRollback>[0]>[0],
		status = 'active'
	) {
		const member = await insertMember(tx, { firstName: 'Արամ', lastName: 'Պետրոսյան' });
		const admin = await insertStaff(tx, 'admin');
		const cert = await insertCertificate(tx, {
			userId: member.id,
			kind: 'judge',
			issuedBy: admin.id,
			...(status === 'revoked'
				? { status: 'revoked' as const, revokedAt: new Date(), revokeReason: 'Mistake' }
				: {})
		});
		return { member, admin, cert };
	}

	it('stores the PDF under a fixed key and sets file_key; remaking overwrites it', async () => {
		await inRollback(async (tx) => {
			const { member, cert } = await certificate(tx);
			const d = deps();
			expect(await storeCertificatePdf(tx, d, cert.id)).toBe('ok');
			const key = certificatePdfKey(member.id, cert.id);
			expect(key).toBe(`certificates/${member.id}/${cert.id}.pdf`);
			expect((await certRow(tx, cert.id)).fileKey).toBe(key);
			expect(isPdf(d.storage.objects.get(key))).toBe(true);

			expect(await storeCertificatePdf(tx, d, cert.id)).toBe('ok');
			expect([...d.storage.objects.keys()]).toEqual([key]);
		});
	});

	it('revoked, unknown, no seal, no bucket, no site address — no PDF, file_key untouched', async () => {
		await inRollback(async (tx) => {
			const revoked = await certificate(tx, 'revoked');
			const d = deps();
			expect(await storeCertificatePdf(tx, d, revoked.cert.id)).toBe('revoked');
			expect(await storeCertificatePdf(tx, d, crypto.randomUUID())).toBe('not_found');
			expect(d.storage.objects.size).toBe(0);

			const { cert } = await certificate(tx);
			expect(await storeCertificatePdf(tx, deps(fakeStorage(), null), cert.id)).toBe(
				'assets_missing'
			);
			expect(await storeCertificatePdf(tx, { ...deps(), siteUrl: undefined }, cert.id)).toBe(
				'site_url_missing'
			);
			const offline = {
				...fakeStorage(),
				put: async () => {
					throw new StorageNotConfigured('no bucket');
				}
			};
			expect(await storeCertificatePdf(tx, deps(offline), cert.id)).toBe('storage_missing');
			expect((await certRow(tx, cert.id)).fileKey).toBeNull();
		});
	});

	it('remaking: admin only, with the audit entry; revoked and unknown refused', async () => {
		await inRollback(async (tx) => {
			const { cert, admin } = await certificate(tx);
			const moderator = await insertStaff(tx, 'moderator');
			const d = deps();
			expect(await regenerateCertificatePdf(tx, moderator, cert.id, d, null)).toBe('not_allowed');
			expect(d.storage.objects.size).toBe(0);
			expect(await regenerateCertificatePdf(tx, admin, 'not-a-uuid', d, null)).toBe('not_found');

			expect(await regenerateCertificatePdf(tx, admin, cert.id, d, '198.51.100.7')).toBe('ok');
			const entries = await auditFor(tx, 'certificate', cert.id);
			expect(entries.map((e) => e.action)).toEqual(['certificate.pdf']);
			expect(entries[0]).toMatchObject({
				actorId: admin.id,
				after: { number: cert.number, fileKey: certificatePdfKey(cert.userId, cert.id) }
			});

			const revoked = await certificate(tx, 'revoked');
			expect(await regenerateCertificatePdf(tx, admin, revoked.cert.id, d, null)).toBe('revoked');
			expect(await auditFor(tx, 'certificate', revoked.cert.id)).toEqual([]);
		});
	});

	it('the issue makes the PDF before the letter; a PDF failure keeps the issue and the letter', async () => {
		await inRollback(async (tx) => {
			const admin = await insertStaff(tx, 'admin');
			const member = await insertMember(tx, { level: 'novice' });
			const exam = await passedExam(tx, member.id);
			const letters: Mail[] = [];
			const storage = fakeStorage();
			const send = async (mail: Mail) => {
				expect(storage.objects.size).toBe(1);
				letters.push(mail);
			};
			const input = { userId: member.id, kind: 'level' as const, level: 'advanced' as const };
			const base = { settings: SETTINGS, send, siteUrl: 'https://parkour.test' };

			const done = await issueCertificate(
				tx,
				admin,
				{ ...input, examId: exam.id },
				{ ...base, pdf: deps(storage) },
				null
			);
			if (!done.ok) throw new Error(done.reason);
			expect(done.pdf).toBe('ok');
			expect((await certRow(tx, done.id)).fileKey).toBe(certificatePdfKey(member.id, done.id));
			expect(letters).toHaveLength(1);

			const judge = await issueCertificate(
				tx,
				admin,
				{ userId: member.id, kind: 'judge', comment: 'Transfer' },
				{ ...base, send: async (m) => void letters.push(m), pdf: deps(fakeStorage(), null) },
				null
			);
			if (!judge.ok) throw new Error(judge.reason);
			expect(judge.pdf).toBe('assets_missing');
			expect((await certRow(tx, judge.id)).fileKey).toBeNull();
			expect(letters).toHaveLength(2);

			const broken = {
				...deps(),
				images: async () => ({ ...TEST_IMAGES, seal: new Uint8Array(3) })
			};
			const trainer = await issueCertificate(
				tx,
				admin,
				{ userId: member.id, kind: 'trainer', comment: 'Transfer' },
				{ settings: SETTINGS, pdf: broken },
				null
			);
			expect(trainer).toMatchObject({ ok: true, pdf: 'failed' });

			const plain = await issueCertificate(
				tx,
				admin,
				{ userId: (await insertMember(tx)).id, kind: 'judge', comment: 'Transfer' },
				{ settings: SETTINGS },
				null
			);
			expect(plain).toMatchObject({ ok: true, pdf: null });
		});
	});
});
