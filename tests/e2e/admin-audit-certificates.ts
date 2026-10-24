import { expect, type Page } from '@playwright/test';
import type postgres from 'postgres';
import type { AdminAction } from './admin-audit-map';

type CertificateAction = Extract<AdminAction, `/admin/certificates${string}`>;
type Post = (path: string, form?: Record<string, string>) => Promise<void>;

const ORIGIN = { origin: 'http://localhost:4173' };

/**
 * Certificate actions for admin-audit.spec.ts: a novice written by SQL gets the "Advanced" level
 * without an exam (with a comment) — `certificate.issue` and `user.level`; a certificate written by
 * SQL is revoked. No private bucket in tests: the PDF remake is refused and logs nothing —
 * `certificate.pdf` is covered by services/certificates/pdf-store.test.ts.
 */
export function certificateActions(
	sql: postgres.Sql,
	post: Post,
	page: Page
): Record<CertificateAction, () => Promise<void>> {
	const member = async () => {
		const [user] = await sql`
			insert into users (email, name, first_name, last_name, birth_date, email_verified, level)
			values (${`e2e-audit-cert-${crypto.randomUUID()}@example.com`}, 'Audit Holder', 'Audit',
				'Holder', '1990-01-01', true, 'novice')
			returning id`;
		return user.id as string;
	};
	const certificate = async () => {
		const userId = await member();
		const [cert] = await sql`
			insert into certificates (user_id, kind, number, public_token, issued_at, expires_at, issued_by)
			values (${userId}, 'judge', ${`E2E-${crypto.randomUUID()}`}, ${crypto.randomUUID()}, now(),
				now() + interval '300 days', ${userId})
			returning id`;
		return cert.id as string;
	};
	return {
		'/admin/certificates/new?/default': async () =>
			post('/admin/certificates/new', {
				userId: await member(),
				kind: 'level',
				level: 'advanced',
				category: '',
				examId: '',
				issuedAt: '',
				expiresAt: '',
				comment: 'Audit check'
			}),
		'/admin/certificates/[id]?/pdf': async () => {
			const res = await page.request.post(`/admin/certificates/${await certificate()}?/pdf`, {
				form: {},
				headers: ORIGIN
			});
			expect(res.status()).toBe(400);
		},
		'/admin/certificates/[id]?/revoke': async () =>
			post(`/admin/certificates/${await certificate()}?/revoke`, { comment: 'Audit check' })
	};
}
