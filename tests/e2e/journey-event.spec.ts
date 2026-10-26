import { existsSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import postgres from 'postgres';
import { hydrated } from './hydrated';
import { journeyActors } from './journey-actors';

/* Journey (docs/09, 8.11): an event from creation to points. The admin creates and publishes a free
 * event; a member finds it, registers and sees it in the cabinet; on the event day the admin marks
 * "came", saves place 1 and finishes the event; the member sees the place and the points of the
 * registration, the participation and the place (docs/03 sections 6.2, 7; docs/05 section 5).
 * Time passing is the one shortcut: the event is moved into the past before its day. */

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
const actors = journeyActors(sql);
test.afterAll(() => sql.end());
test('admin publishes an event, a member registers, takes part and gets the place and points', async ({
	page,
	browser
}) => {
	test.setTimeout(180_000);
	const points = await actors.ensureRules({
		event_registration: 5,
		event_participation: 10,
		event_place_1: 30
	});
	const tag = crypto.randomUUID().slice(0, 8);
	const slug = `e2e-journey-${tag}`;
	const title = `Journey jam ${tag}`;
	const city = `E2e ${tag}`;

	const admin = await (await browser.newContext()).newPage();
	await actors.staff(admin, 'admin');
	await admin.goto('/admin/events/new');
	await admin.getByLabel('Page address').fill(slug);
	await admin.getByLabel('Title (English)').fill(title);
	await admin.getByRole('textbox', { name: 'Description (English)' }).click();
	await admin.keyboard.type('Open training for members');
	await admin.getByLabel('Starts').fill('2099-06-01T11:00');
	await admin.getByLabel('Ends').fill('2099-06-01T15:00');
	await admin.getByLabel('Venue').fill('Parkour park');
	await admin.getByLabel('City').fill(city);
	await admin.getByLabel('Price').fill('0');
	await admin.getByRole('button', { name: 'Save' }).click();
	await expect(admin).toHaveURL(/\/admin\/events\/[0-9a-f-]{36}$/);
	const eventId = admin.url().split('/').pop()!;
	await admin.getByRole('button', { name: 'Publish' }).click();
	await expect(admin.getByRole('button', { name: 'Unpublish' })).toBeVisible();

	const member = await actors.member(page, 'Jam');
	await actors.grantMembership(member);
	await page.goto(`/events?city=${encodeURIComponent(city)}`);
	await page.getByRole('link', { name: title }).click();
	await expect(page).toHaveURL(`/events/${slug}`);
	await hydrated(page);
	await page.getByRole('button', { name: 'Register' }).click();
	await expect(page.getByText('You are registered.')).toBeVisible();

	await page.goto('/cabinet/events');
	const upcoming = page.getByRole('listitem').filter({ hasText: title });
	await expect(upcoming.getByText('Registered')).toBeVisible();

	await sql`update events set starts_at = now() - interval '3 hours',
		ends_at = now() - interval '1 hour' where id = ${eventId}`;

	await admin.goto(`/admin/registrations/${eventId}/day`);
	await hydrated(admin);
	const card = admin.getByRole('listitem').filter({ hasText: member.name });
	await card.getByRole('button', { name: 'Came', exact: true }).click();
	await expect(admin.getByText('Came: 1 of 1.')).toBeVisible();

	await admin.goto(`/admin/registrations/${eventId}/results`);
	await hydrated(admin);
	await admin.getByLabel(`Place — ${member.name}`).fill('1');
	await admin.getByLabel(`Score — ${member.name}`).fill('88.25');
	await admin.getByRole('button', { name: 'Save results' }).click();
	await expect(admin.getByText('Results saved.')).toBeVisible();
	await admin.getByRole('button', { name: 'Finish the event' }).click();
	await admin.getByRole('dialog').getByRole('button', { name: 'Finish the event' }).click();
	await expect(admin.getByText('Finished', { exact: true })).toBeVisible();

	await page.goto('/cabinet/events?tab=past');
	const past = page.getByRole('listitem').filter({ hasText: title });
	await expect(past.getByText('Took part')).toBeVisible();
	await expect(past.getByText('Place: 1')).toBeVisible();
	await expect(past.getByText('Score: 88.25')).toBeVisible();
	await expect(past.getByText(`Points: ${points}`)).toBeVisible();

	const [registration] = await sql`select r.status, r.place, e.status as event
		from event_registrations r join events e on e.id = r.event_id
		where r.event_id = ${eventId} and r.user_id = ${member.id}`;
	expect(registration).toEqual({ status: 'attended', place: 1, event: 'finished' });
	expect(await actors.balanceOf(member)).toBe(points);
});
