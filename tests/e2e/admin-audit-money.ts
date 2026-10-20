import type postgres from 'postgres';
import type { AdminAction } from './admin-audit-map';

type MoneyAction = Extract<
	AdminAction,
	`/admin/payments${string}` | `/admin/donation-purposes${string}`
>;
type Post = (path: string, form?: Record<string, string>) => Promise<void>;

/** Payment and donation purpose actions for admin-audit.spec.ts, each on its own fresh row. */
export function moneyActions(
	sql: postgres.Sql,
	post: Post,
	postRedirect: Post
): Record<MoneyAction, () => Promise<void>> {
	const payment = async (status: 'pending' | 'paid', needsReview = false) =>
		(
			await sql`
			insert into payments (kind, status, amount_minor, currency, provider, donor_name, donor_email,
				paid_at, needs_review)
			values ('donation', ${status}, 5000, 'AMD', 'manual', 'E2e audit donor',
				'e2e-audit-donor@example.com', ${status === 'paid' ? new Date() : null}, ${needsReview})
			returning id`
		)[0].id as string;
	const title = `E2e audit purpose ${crypto.randomUUID()}`;
	const purposeId = async () =>
		(await sql`select id from donation_purposes where title->>'en' = ${title}`)[0].id as string;
	const comment = { comment: 'Audit check' };

	return {
		'/admin/payments/new?/default': () =>
			postRedirect('/admin/payments/new', {
				kind: 'donation',
				amount: '1000',
				currency: 'AMD',
				paidOn: '2026-01-15',
				comment: 'Audit check',
				donorName: 'E2e audit donor'
			}),
		'/admin/payments/[id]?/confirm': async () =>
			post(`/admin/payments/${await payment('pending')}?/confirm`, comment),
		'/admin/payments/[id]?/refund': async () =>
			post(`/admin/payments/${await payment('paid')}?/refund`, comment),
		'/admin/payments/[id]?/resolve': async () =>
			post(`/admin/payments/${await payment('pending', true)}?/resolve`, comment),
		'/admin/payments/[id]?/receipt': async () =>
			post(`/admin/payments/${await payment('paid')}?/receipt`),
		'/admin/donation-purposes/new?/default': () =>
			postRedirect('/admin/donation-purposes/new', { 'title.en': title, isActive: 'on' }),
		/* Hidden afterwards: the dev /donate page does not collect test purposes. */
		'/admin/donation-purposes/[id]?/update': async () =>
			post(`/admin/donation-purposes/${await purposeId()}?/update`, { 'title.en': title })
	};
}
