import { existsSync } from 'node:fs';
import postgres from 'postgres';

const BASE = 'http://localhost:4173';

/* Specs leave their rows behind, and on a long-lived database (parkour_dev) they pile up: with
 * hundreds of staff /admin/roles renders a dialog per row and locators time out; with ~60 live hero
 * blocks a reorder updates each of them inside one transaction for seconds. Rows of earlier runs
 * are retired softly. Two runs against one database at a time are not supported. */
async function retireLeftovers(url: string) {
	const sql = postgres(url, { max: 1, onnotice: () => {} });
	try {
		await sql`
			update users set deleted_at = now()
			where email like 'e2e-%@example.com' and deleted_at is null`;
		await sql`
			update hero_blocks set is_active = false, archived_at = now()
			where title->>'en' like 'E2e %' and archived_at is null`;
		/* CI migrates a fresh database without the seed: /federation needs the system page. */
		await sql`
			insert into pages (slug, title, status, is_system)
			values ('about', ${sql.json({ en: 'About the federation' })}, 'published', true)
			on conflict (slug) do nothing`;
	} finally {
		await sql.end();
	}
}

/* The first test of every worker signs up at once: on a cold server (modules not loaded, no
 * database connections, auth not created) that took longer than the expect timeout. */
async function warmUp() {
	await Promise.all(Array.from({ length: 6 }, () => fetch(`${BASE}/`).then((r) => r.text())));
	const body = new URLSearchParams({
		email: `e2e-warmup-${crypto.randomUUID()}@example.com`,
		password: 'parkour-pass-1',
		firstName: 'Warm',
		lastName: 'Up',
		birthDate: '1990-01-01',
		terms: 'on'
	});
	await fetch(`${BASE}/register`, { method: 'POST', body, headers: { origin: BASE } });
}

/* The web server is already up when this runs. */
export default async function globalSetup() {
	if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
	if (process.env.DATABASE_URL) await retireLeftovers(process.env.DATABASE_URL);
	await warmUp();
}
