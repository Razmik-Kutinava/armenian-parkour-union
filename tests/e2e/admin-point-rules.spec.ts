import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';

/* docs/05 sections 12–13, docs/03 section 6.4: an admin sees the rules with who and when changed
 * them, edits title, points and "active" but never the code; edits the thresholds of "suspicious";
 * the ledger filter "suspicious" shows manual entries and hides a small system one. Moderators read
 * the ledger with the filter and the rules with thresholds (owner 2026-10-21), but change nothing.
 * Test rules are inactive e2e codes. */

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
const ORIGIN = { origin: 'http://localhost:4173' };

test.afterAll(() => sql.end());
test.beforeEach(async () => {
	await sql`delete from rate_limit where key ~ '^sign-up:ip:(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$'`;
});

async function registerAs(page: Page, role: 'moderator' | 'admin') {
	const email = `e2e-rules-${role}-${crypto.randomUUID()}@example.com`;
	await page.goto('/register');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('parkour-pass-1');
	await page.getByLabel('First name').fill('Rules');
	await page.getByLabel('Last name').fill(role);
	await page.getByLabel('Date of birth').fill('1990-01-01');
	await page.getByLabel(/privacy policy/).check();
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/');
	const [row] = await sql`update users set role = ${role} where email = ${email} returning id`;
	return row.id as string;
}

async function insertRule() {
	const code = `e2e-rules-${crypto.randomUUID().slice(0, 8)}`;
	const [row] = await sql`
		insert into points_rules (code, title, points, is_active)
		values (${code}, ${sql.json({ en: 'E2e rule' })}, 10, false) returning id`;
	return { id: row.id as string, code };
}

const ruleRow = async (id: string) =>
	(
		await sql`select code, title, points, is_active, updated_by from points_rules where id = ${id}`
	)[0];

test('admin: rules list, edit without the code, audit; thresholds saved', async ({ page }) => {
	const adminId = await registerAs(page, 'admin');
	const rule = await insertRule();
	try {
		await page.goto('/admin/point-rules');
		const row = page.getByRole('row', { name: new RegExp(rule.code) });
		await expect(row).toContainText('E2e rule');
		await expect(row).toContainText('10');

		await row.getByRole('link', { name: rule.code }).click();
		await expect(page.locator('main')).toContainText(rule.code);
		await page.getByLabel('Title (English)').fill('E2e rule edited');
		await page.getByLabel('Points').fill('12');
		await page.getByLabel('Active').check();
		await page.getByRole('button', { name: 'Save' }).click();
		await expect(page.getByRole('status')).toBeVisible();
		expect(await ruleRow(rule.id)).toMatchObject({
			code: rule.code,
			title: { en: 'E2e rule edited' },
			points: 12,
			is_active: true,
			updated_by: adminId
		});
		const audit = await sql`
			select action, host(ip) as ip from audit_log where entity_id = ${rule.id} and actor_id = ${adminId}`;
		expect(audit).toHaveLength(1);
		expect(audit[0].action).toBe('points.rule_update');
		expect(audit[0].ip).not.toBeNull();

		const hostile = await page.request.post(`/admin/point-rules/${rule.id}`, {
			form: { 'title.en': 'E2e rule edited', points: '13', code: 'hacked' },
			headers: ORIGIN
		});
		expect(hostile.ok()).toBe(true);
		expect(await ruleRow(rule.id)).toMatchObject({ code: rule.code, points: 13, is_active: false });

		const bad = await page.request.post(`/admin/point-rules/${rule.id}`, {
			form: { 'title.en': 'E2e rule edited', points: '-5' },
			headers: ORIGIN
		});
		expect(bad.status()).toBe(400);
		expect((await ruleRow(rule.id)).points).toBe(13);

		await page.goto('/admin/point-rules');
		await expect(row).toContainText('E2e rule edited');
		await expect(row).toContainText('Rules admin');

		const [stored] = await sql`select value from site_settings where key = 'points_suspicious'`;
		const amount = page.getByLabel('Amount from');
		await expect(amount).toBeVisible();
		await amount.fill('150');
		await page.getByRole('button', { name: 'Save thresholds' }).click();
		await expect(page.getByRole('status')).toBeVisible();
		const [saved] = await sql`select value from site_settings where key = 'points_suspicious'`;
		expect(saved.value.min_amount).toBe(150);
		const back = stored?.value ?? {
			manual: true,
			min_amount: 100,
			burst_count: 5,
			burst_hours: 24
		};
		await sql`update site_settings set value = ${sql.json(back)} where key = 'points_suspicious'`;
	} finally {
		await sql`delete from points_rules where id = ${rule.id}`;
	}
});

test('moderator: the ledger filter "suspicious" shows manual entries; rules read-only', async ({
	page
}) => {
	const moderatorId = await registerAs(page, 'moderator');
	const email = `e2e-rules-member-${crypto.randomUUID()}@example.com`;
	const [member] = await sql`
		insert into users (email, name, first_name, last_name, birth_date, points_balance)
		values (${email}, 'Rules Member', 'Rules', 'Member', '1990-01-01', 8) returning id`;
	const manual = `Suspicious manual ${crypto.randomUUID().slice(0, 8)}`;
	await sql`insert into points_ledger (user_id, delta, reason, comment, created_by)
		values (${member.id}, 3, 'manual', ${manual}, ${moderatorId})`;
	await sql`insert into points_ledger (user_id, delta, reason, source_type, source_id)
		values (${member.id}, 5, 'event_participation', 'event_registration', ${crypto.randomUUID()})`;

	await page.goto(`/admin/points?q=${encodeURIComponent(email)}`);
	await expect(page.getByRole('row')).toHaveCount(3);
	await page.getByLabel('Suspicious').selectOption('1');
	await page.getByRole('button', { name: 'Apply' }).click();
	await expect(page).toHaveURL(/suspicious=1/);
	await expect(page.getByRole('row', { name: new RegExp(manual) })).toBeVisible();
	await expect(page.getByRole('row')).toHaveCount(2);

	const rule = await insertRule();
	try {
		await page.goto('/admin/point-rules');
		const row = page.getByRole('row', { name: new RegExp(rule.code) });
		await expect(row).toContainText('E2e rule');
		await expect(row.getByRole('link')).toHaveCount(0);
		await expect(page.getByLabel('Amount from')).toBeDisabled();
		await expect(page.getByRole('button', { name: 'Save thresholds' })).toHaveCount(0);

		expect((await page.request.get(`/admin/point-rules/${rule.id}`)).status()).toBe(403);
		const edit = await page.request.post(`/admin/point-rules/${rule.id}`, {
			form: { 'title.en': 'Hacked', points: '999' },
			headers: ORIGIN
		});
		expect(edit.status()).toBe(403);
		expect((await ruleRow(rule.id)).points).toBe(10);
		const thresholds = await page.request.post('/admin/point-rules?/thresholds', {
			form: { minAmount: '1', burstCount: '2', burstHours: '1' },
			headers: ORIGIN
		});
		expect(thresholds.status()).toBe(403);
	} finally {
		await sql`delete from points_rules where id = ${rule.id}`;
	}
});
