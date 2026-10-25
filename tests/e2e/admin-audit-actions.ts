import { expect, type Page } from '@playwright/test';
import type postgres from 'postgres';
import { certificateActions } from './admin-audit-certificates';
import { consentActions } from './admin-audit-consents';
import { examActions } from './admin-audit-exams';
import type { AdminAction } from './admin-audit-map';
import { moneyActions } from './admin-audit-money';
import { pointsActions } from './admin-audit-points';
import { registrationActions } from './admin-audit-registrations';
import { shopActions } from './admin-audit-shop';
import { videoActions } from './admin-audit-videos';
import { paymentSettingsAction } from './payment-settings-form';

const ORIGIN = { origin: 'http://localhost:4173' };
const PROFILE = { firstName: 'Audit', lastName: 'Target', birthDate: '1991-03-03' };

/** Every admin action against fresh rows; admin-audit.spec.ts runs them and checks the journal. */
export async function adminActions(page: Page, sql: postgres.Sql, adminId: string, target: string) {
	const post = async (path: string, form: Record<string, string> = {}) => {
		const res = await page.request.post(path, { form, headers: ORIGIN });
		expect(res.ok(), path).toBe(true);
	};
	const card = `/admin/users/${target}`;
	const [file] = await sql`
		insert into media (key, original_name, mime, size_bytes, uploaded_by)
		values (${`media/2026/10/${crypto.randomUUID()}.png`}, 'audit.png', 'image/png', 10, ${adminId})
		returning id`;
	const pageSlug = `e2e-audit-${crypto.randomUUID().slice(0, 8)}`;
	const pageForm = { slug: pageSlug, 'title.en': 'Audit page', status: 'draft' };
	const pageId = async () =>
		(await sql`select id from pages where slug = ${pageSlug}`)[0].id as string;
	const postSlug = `e2e-audit-${crypto.randomUUID().slice(0, 8)}`;
	const postForm = { slug: postSlug, 'title.en': 'Audit post', status: 'draft' };
	const postId = async () =>
		(await sql`select id from posts where slug = ${postSlug}`)[0].id as string;
	const eventSlug = `e2e-audit-${crypto.randomUUID().slice(0, 8)}`;
	const eventForm = {
		slug: eventSlug,
		'title.en': 'Audit event',
		startsAt: '2099-05-01T10:00',
		endsAt: '2099-05-01T18:00',
		price: '0',
		priceCurrency: 'AMD',
		status: 'draft'
	};
	const eventId = async () =>
		(await sql`select id from events where slug = ${eventSlug}`)[0].id as string;
	const categoryId = async () =>
		(await sql`select id from event_categories where event_id = ${await eventId()}`)[0]
			.id as string;
	const categoryForm = { 'name.en': 'Audit category', discipline: 'speed' };
	const [startedEvent] = await sql`
		insert into events (slug, title, status, published_at, starts_at, ends_at)
		values (${`e2e-audit-${crypto.randomUUID().slice(0, 8)}`}, ${sql.json({ en: 'Started' })},
			'published', now() - interval '2 days', now() - interval '1 day', now() - interval '20 hours')
		returning id`;
	/* Not "E2e hero …": hero.spec.ts archives those in parallel. */
	const heroForm = { type: 'custom', 'title.en': `E2e audit hero ${crypto.randomUUID()}` };
	/* The duplicate has the same title: always the first one. */
	const heroId = async () =>
		(
			await sql`select id from hero_blocks where title->>'en' = ${heroForm['title.en']}
				order by created_at limit 1`
		)[0].id as string;
	const postRedirect = async (path: string, form: Record<string, string> = {}) => {
		const res = await page.request.post(path, { form, headers: ORIGIN, maxRedirects: 0 });
		expect(res.status(), path).toBeLessThan(400);
	};

	/* Typed by the map: a new admin action does not compile until it is exercised here. */
	const perform: Record<AdminAction, () => Promise<void>> = {
		'/admin/users/[id]?/update': () => post(`${card}?/update`, { ...PROFILE, city: 'Gyumri' }),
		'/admin/users/[id]?/role': () => post(`${card}?/role`, { role: 'editor' }),
		'/admin/roles?/grant': () => post('/admin/roles?/grant', { userId: target, role: 'moderator' }),
		'/admin/roles?/revoke': () => post('/admin/roles?/revoke', { userId: target }),
		'/admin/users/[id]?/block': () => post(`${card}?/block`, { comment: 'Audit check' }),
		'/admin/users/[id]?/unblock': () => post(`${card}?/unblock`),
		'/admin/users/[id]?/confirmEmail': () => post(`${card}?/confirmEmail`),
		'/admin/users/[id]?/passwordLink': () => post(`${card}?/passwordLink`),
		'/admin/users/new?/default': () =>
			post('/admin/users/new', {
				...PROFILE,
				email: `e2e-audit-new-${crypto.randomUUID()}@example.com`
			}),
		/* The stored form as rendered, phone changed: no typing before hydration.
		   The CI database starts empty, so required fields get a value if missing. */
		'/admin/settings?/default': async () => {
			await page.goto('/admin/settings');
			const field = page.getByLabel('Phone', { exact: true });
			const form = await field.evaluate((el: HTMLInputElement) =>
				Object.fromEntries([...new FormData(el.form!)].map(([k, v]) => [k, String(v)]))
			);
			form['site_name.en'] ||= 'Armenian Parkour Union';
			form['seo_description.en'] ||= 'Parkour in Armenia';
			const name = (await field.getAttribute('name'))!;
			const phone = `+374 10 ${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}`;
			await post('/admin/settings', { ...form, [name]: phone });
		},
		/* No bucket in tests: the object is never there, so complete is refused and logs nothing.
		   media.upload with a stored object is covered by services/media/upload.test.ts. */
		'/admin/media?/complete': async () => {
			const key = `media/2026/10/${crypto.randomUUID()}.png`;
			const res = await page.request.post('/admin/media?/complete', {
				form: { key, name: 'audit.png' },
				headers: ORIGIN
			});
			expect(res.status()).toBe(400);
		},
		'/admin/media/[id]?/alt': () => post(`/admin/media/${file.id}?/alt`, { 'alt.en': 'Audit' }),
		'/admin/media/[id]?/delete': async () => {
			const res = await page.request.post(`/admin/media/${file.id}?/delete`, {
				form: {},
				headers: ORIGIN,
				maxRedirects: 0
			});
			expect(res.status()).toBeLessThan(400);
		},
		'/admin/pages/new?/default': async () => {
			const res = await page.request.post('/admin/pages/new', {
				form: pageForm,
				headers: ORIGIN,
				maxRedirects: 0
			});
			expect(res.status()).toBeLessThan(400);
		},
		'/admin/pages/[id]?/update': async () =>
			post(`/admin/pages/${await pageId()}?/update`, { ...pageForm, status: 'published' }),
		'/admin/pages/[id]?/delete': async () => {
			const res = await page.request.post(`/admin/pages/${await pageId()}?/delete`, {
				form: {},
				headers: ORIGIN,
				maxRedirects: 0
			});
			expect(res.status()).toBeLessThan(400);
		},
		'/admin/news/new?/default': async () => {
			const res = await page.request.post('/admin/news/new', {
				form: postForm,
				headers: ORIGIN,
				maxRedirects: 0
			});
			expect(res.status()).toBeLessThan(400);
		},
		'/admin/news/[id]?/update': async () =>
			post(`/admin/news/${await postId()}?/update`, { ...postForm, 'title.en': 'Audit post 2' }),
		'/admin/news/[id]?/status': async () =>
			post(`/admin/news/${await postId()}?/status`, { status: 'published' }),
		'/admin/news/[id]?/duplicate': async () =>
			postRedirect(`/admin/news/${await postId()}?/duplicate`),
		'/admin/news/[id]?/delete': async () => postRedirect(`/admin/news/${await postId()}?/delete`),
		'/admin/events/new?/default': () => postRedirect('/admin/events/new', eventForm),
		'/admin/events/[id]?/update': async () =>
			post(`/admin/events/${await eventId()}?/update`, { ...eventForm, city: 'Gyumri' }),
		'/admin/events/[id]?/categoryCreate': async () =>
			post(`/admin/events/${await eventId()}?/categoryCreate`, categoryForm),
		'/admin/events/[id]?/categoryUpdate': async () =>
			post(`/admin/events/${await eventId()}?/categoryUpdate`, {
				...categoryForm,
				categoryId: await categoryId(),
				ageMin: '10'
			}),
		'/admin/events/[id]?/categoryDelete': async () =>
			post(`/admin/events/${await eventId()}?/categoryDelete`, { categoryId: await categoryId() }),
		'/admin/events/[id]?/status': async () =>
			post(`/admin/events/${await eventId()}?/status`, { action: 'publish' }),
		'/admin/events/[id]?/duplicate': async () =>
			postRedirect(`/admin/events/${await eventId()}?/duplicate`),
		'/admin/events/[id]?/cancel': async () =>
			post(`/admin/events/${await eventId()}?/cancel`, { comment: 'Audit check' }),
		'/admin/events/[id]?/finish': () => post(`/admin/events/${startedEvent.id}?/finish`),
		'/admin/events/[id]?/archive': async () => post(`/admin/events/${await eventId()}?/archive`),
		'/admin/events/[id]?/restore': async () => post(`/admin/events/${await eventId()}?/restore`),
		'/admin/events/[id]?/delete': async () =>
			postRedirect(`/admin/events/${await eventId()}?/delete`),
		'/admin/hero/new?/default': () => postRedirect('/admin/hero/new', heroForm),
		'/admin/hero/[id]?/update': async () =>
			post(`/admin/hero/${await heroId()}?/update`, { ...heroForm, 'subtitle.en': 'Audit' }),
		/* On and back off: hero.activate and hero.deactivate, the block stays off. */
		'/admin/hero?/toggle': async () => {
			const id = await heroId();
			await post('/admin/hero?/toggle', { id, active: 'true' });
			await post('/admin/hero?/toggle', { id, active: 'false' });
		},
		/* The whole current list; hero.spec.ts may add a block meanwhile, so read and retry. */
		'/admin/hero?/reorder': async () => {
			await expect(async () => {
				const rows =
					await sql`select id from hero_blocks where archived_at is null order by sort_order desc`;
				await post('/admin/hero?/reorder', { order: rows.map((r) => r.id).join(',') });
			}).toPass({ timeout: 15_000 });
		},
		'/admin/hero/[id]?/duplicate': async () =>
			postRedirect(`/admin/hero/${await heroId()}?/duplicate`),
		'/admin/hero/[id]?/archive': async () => post(`/admin/hero/${await heroId()}?/archive`),
		'/admin/hero/[id]?/restore': async () => post(`/admin/hero/${await heroId()}?/restore`),
		...moneyActions(sql, post, postRedirect),
		...pointsActions(sql, post, target),
		...consentActions(sql, post, target),
		...registrationActions(sql, post),
		...examActions(sql, post),
		...certificateActions(sql, post, page),
		...paymentSettingsAction(page, post),
		...videoActions(sql, post, page, target),
		...shopActions(sql, post, postRedirect, target)
	};
	return perform;
}
