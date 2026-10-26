import { existsSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import postgres from 'postgres';
import { hydrated } from './hydrated';
import { journeyActors } from './journey-actors';

/* Journey (docs/09, 8.11): joining and paying the fee. A guest signs up and confirms the email; the
 * admin records the bank transfer of the fee (docs/07 section 9); the member sees the membership,
 * the paid fee and the "Novice" level (docs/03 section 3). Online payment is not on this server: the
 * e2e build has no mock and VPOS waits for access — its chain is in payments/acceptance-*.test.ts.
 * /join and the fee amount are not touched: membership.spec changes them in parallel. */

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
const actors = journeyActors(sql);
test.afterAll(() => sql.end());
const daysAgo = (days: number) =>
	new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

test('guest signs up, confirms the email, the admin records the fee, the member is in', async ({
	page,
	browser
}) => {
	test.setTimeout(120_000);
	await page.goto('/cabinet/membership');
	await expect(page).toHaveURL('/login?returnTo=%2Fcabinet%2Fmembership');
	const member = await actors.signUp(page, 'Fee');
	await actors.confirmEmail(page, member);
	await page.goto('/cabinet/membership');
	const main = page.locator('main');
	await expect(main.getByText('No active membership')).toBeVisible();

	const admin = await (await browser.newContext()).newPage();
	const adminUser = await actors.staff(admin, 'admin');
	const comment = `Bank transfer ${crypto.randomUUID().slice(0, 8)}`;
	await admin.goto('/admin/payments/new');
	/* A type chosen before hydration is reset to "donation". */
	await hydrated(admin);
	await admin.getByLabel('Type').selectOption('membership');
	await admin.getByLabel('Amount').fill('20000');
	await admin.getByLabel('Payment date').fill(daysAgo(2));
	await admin.getByLabel(/Comment/).fill(comment);
	await admin.getByLabel('Member email').fill(member.email);
	await admin.getByRole('button', { name: 'Record as paid' }).click();
	await expect(admin).toHaveURL(/\/admin\/payments\/[0-9a-f-]{36}\?created/);
	await expect(admin.getByText('The payment has been recorded.')).toBeVisible();
	await expect(admin.locator('main')).toContainText('Membership fee');

	await page.reload();
	await expect(main.getByText(/^Active until /)).toBeVisible();
	await expect(main.getByRole('heading', { name: 'History' })).toBeVisible();

	await page.goto('/cabinet/payments');
	const row = main.getByRole('row').filter({ hasText: 'Membership fee' });
	await expect(row).toContainText('20,000');
	await expect(row).toContainText('Paid');

	await page.goto('/cabinet/progress');
	const scale = main.getByRole('list', { name: 'Levels' });
	await expect(scale.locator('[aria-current="step"]')).toContainText('Novice');

	const [payment] = await sql`select p.status, p.provider, p.amount_minor, p.membership_id,
		m.status as membership, m.payment_id, u.level
		from payments p join memberships m on m.id = p.membership_id join users u on u.id = p.user_id
		where p.user_id = ${member.id}`;
	expect(payment).toMatchObject({
		status: 'paid',
		provider: 'manual',
		amount_minor: 20_000,
		membership: 'active',
		level: 'novice'
	});
	const log = await sql`select action from audit_log where actor_id = ${adminUser.id}`;
	expect(log.map((r) => r.action)).toContain('payment.confirm_manual');
});
