import { existsSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import postgres from 'postgres';
import { ADMIN_READS, ADMIN_WRITES } from './admin-access-map';
import { certificateFixtures } from './admin-permissions-certs';
import {
	expectedStatus,
	HOSTILE_FORM,
	ORIGIN,
	permissionFixtures,
	toPath
} from './admin-permissions-fixtures';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());
/* Only sign-up counters: auth.spec.ts runs in parallel and checks the sign-in limit. */
test.beforeEach(async () => {
	await sql`delete from rate_limit where key ~ '^sign-up:ip:(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$'`;
});

const {
	registerAs,
	insertMember,
	insertMedia,
	insertPage,
	insertPost,
	insertEvent,
	insertHero,
	insertPayment,
	insertPurpose,
	insertPoints,
	insertRule,
	ruleRow,
	pointsRows,
	moneyRows,
	targetRow,
	mediaRow,
	pageRow,
	postRow,
	eventRows,
	heroRow,
	insertExam,
	examRows
} = permissionFixtures(sql);
const { insertCertificate, certificateRows } = certificateFixtures(sql);

/* Pending: approve and reject could really run on it. */
const insertConsent = async (userId: string) =>
	(
		await sql`insert into consents (user_id, kind, file_key, signed_at)
			values (${userId}, 'medical', ${`consents/${userId}/${crypto.randomUUID()}.pdf`}, now())
			returning id`
	)[0].id as string;
const consentRow = async (id: string) =>
	(
		await sql`select status, reviewed_by, review_note, valid_until from consents where id = ${id}`
	)[0];
type Extra = { consentId: string; certificateId: string };
const pathOf = (key: string, ids: Parameters<typeof toPath>[1], extra: Extra) =>
	toPath(key, ids)
		.replace('/consents/[id]', `/consents/${extra.consentId}`)
		.replace('/certificates/[id]', `/certificates/${extra.certificateId}`);

for (const role of ['member', 'editor', 'moderator'] as const) {
	test(`${role}: every admin page and action answers by docs/04, data stays`, async ({ page }) => {
		test.setTimeout(90_000);
		const target = await insertMember();
		const before = await targetRow(target);
		const ids = {
			userId: target,
			auditId: crypto.randomUUID(),
			mediaId: await insertMedia(target),
			pageId: await insertPage(),
			postId: await insertPost(),
			eventId: await insertEvent(),
			heroId: await insertHero(),
			paymentId: await insertPayment(),
			purposeId: await insertPurpose(),
			ruleId: await insertRule(),
			examId: await insertExam(target)
		};
		const examsBefore = await examRows(target);
		const entryId = await insertPoints(target);
		const pointsBefore = await pointsRows(target);
		const ruleBefore = await ruleRow(ids.ruleId);
		const moneyBefore = await moneyRows(ids.paymentId, ids.purposeId);
		const mediaBefore = await mediaRow(ids.mediaId);
		const pageBefore = await pageRow(ids.pageId);
		const postBefore = await postRow(ids.postId);
		const eventBefore = await eventRows(ids.eventId);
		const heroBefore = await heroRow(ids.heroId);
		const consentId = await insertConsent(target);
		const consentBefore = await consentRow(consentId);
		const extra = { consentId, certificateId: await insertCertificate(target) };
		const certificatesBefore = await certificateRows(target);
		await registerAs(page, role);

		for (const [key, access] of Object.entries(ADMIN_READS)) {
			const res = await page.request.get(pathOf(key, ids, extra), { maxRedirects: 0 });
			expect(res.status(), `GET ${key}`).toBe(expectedStatus(role, access));
		}
		for (const [key, access] of Object.entries(ADMIN_WRITES)) {
			const expected = expectedStatus(role, access);
			if (expected === 200) continue;
			const res = await page.request.post(pathOf(key, ids, extra), {
				form: HOSTILE_FORM(target, ids.heroId, entryId),
				headers: ORIGIN,
				maxRedirects: 0
			});
			expect(res.status(), `POST ${key}`).toBe(expected);
		}

		expect(await targetRow(target)).toEqual(before);
		expect(await mediaRow(ids.mediaId)).toEqual(mediaBefore);
		expect(await pageRow(ids.pageId)).toEqual(pageBefore);
		expect(await postRow(ids.postId)).toEqual(postBefore);
		expect(await eventRows(ids.eventId)).toEqual(eventBefore);
		expect(await heroRow(ids.heroId)).toEqual(heroBefore);
		expect(await moneyRows(ids.paymentId, ids.purposeId)).toEqual(moneyBefore);
		expect(await pointsRows(target)).toEqual(pointsBefore);
		expect(await ruleRow(ids.ruleId)).toEqual(ruleBefore);
		expect(await consentRow(consentId)).toEqual(consentBefore);
		expect(await examRows(target)).toEqual(examsBefore);
		expect(await certificateRows(target)).toEqual(certificatesBefore);
		expect(
			await sql`select 1 from audit_log where entity_id in (${target}, ${ids.mediaId}, ${ids.pageId}, ${ids.postId}, ${ids.eventId}, ${ids.heroId}, ${ids.paymentId}, ${ids.purposeId}, ${ids.ruleId}, ${ids.examId}, ${extra.certificateId})`
		).toHaveLength(0);
		/* Thresholds are a shared key that admin-audit.spec.ts changes in parallel: check the author. */
		expect(
			await sql`select 1 from audit_log a join users u on u.id = a.actor_id
				where u.email like ${`e2e-perm-${role}-%`} and a.action = 'settings.update'`
		).toHaveLength(0);
		expect(await sql`select 1 from payments where donor_name = 'Hacked'`).toHaveLength(0);
		expect(await sql`select 1 from donation_purposes where title->>'en' = 'Hacked'`).toHaveLength(
			0
		);
		expect(
			await sql`select 1 from hero_blocks where title->>'en' = 'Hacked' and created_at > now() - interval '10 minutes'`
		).toHaveLength(0);
		expect(await sql`select 1 from pages where slug like 'e2e-hostile-%'`).toHaveLength(0);
		expect(await sql`select 1 from posts where slug like 'e2e-hostile-%'`).toHaveLength(0);
		expect(await sql`select 1 from events where slug like 'e2e-hostile-%'`).toHaveLength(0);
		/* Out of the current list: every block there takes part in the reorder of other runs. */
		await sql`update hero_blocks set archived_at = now() where id = ${ids.heroId}`;
		await sql`delete from points_rules where id = ${ids.ruleId}`;
	});
}

test('admin opens every admin page; audit pages take no writes and the entry stays', async ({
	page
}) => {
	test.setTimeout(90_000);
	await registerAs(page, 'admin');
	const target = await insertMember();
	const confirm = await page.request.post(`/admin/users/${target}?/confirmEmail`, {
		form: {},
		headers: ORIGIN
	});
	expect(confirm.ok()).toBe(true);
	const [entry] = await sql`select * from audit_log where entity_id = ${target}`;
	expect(entry.action).toBe('user.email_confirm');

	const ids = {
		userId: target,
		auditId: entry.id,
		mediaId: await insertMedia(target),
		pageId: await insertPage(),
		postId: await insertPost(),
		eventId: await insertEvent(),
		heroId: await insertHero(),
		paymentId: await insertPayment(),
		purposeId: await insertPurpose(),
		ruleId: await insertRule(),
		examId: await insertExam(target)
	};
	const extra = { consentId: await insertConsent(target), certificateId: await insertCertificate(target) };
	for (const key of Object.keys(ADMIN_READS)) {
		const res = await page.request.get(pathOf(key, ids, extra), { maxRedirects: 0 });
		expect(res.status(), `GET ${key}`).toBe(200);
	}
	for (const path of ['/admin/audit', `/admin/audit/${entry.id}`, '/admin/audit/export']) {
		for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
			const res = await page.request.fetch(path, {
				method,
				form: { action: 'changed', id: entry.id },
				headers: ORIGIN,
				maxRedirects: 0
			});
			expect(res.status(), `${method} ${path}`).toBe(405);
		}
	}
	expect(await sql`select * from audit_log where entity_id = ${target}`).toEqual([entry]);
	await sql`update hero_blocks set archived_at = now() where id = ${ids.heroId}`;
	await sql`delete from points_rules where id = ${ids.ruleId}`;
});
