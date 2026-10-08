// npm run db:seed — safe to run again: adds only what is missing (docs/02, "Начальные данные").
import { existsSync } from 'node:fs';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { seedAdmin } from '../src/lib/server/seed/admin';
import { seedPages } from '../src/lib/server/seed/pages';
import { seedSettings } from '../src/lib/server/seed/settings';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const client = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
try {
	const db = drizzle(client);
	const added = await seedSettings(db);
	console.log(`site_settings: ${added.length ? `added ${added.join(', ')}` : 'nothing to add'}`);
	const pages = await seedPages(db);
	console.log(`system pages: ${pages.length ? `added ${pages.join(', ')}` : 'nothing to add'}`);
	const admin = await seedAdmin(db, {
		email: process.env.SEED_ADMIN_EMAIL,
		password: process.env.SEED_ADMIN_PASSWORD
	});
	console.log(`first admin: ${admin}`);
} finally {
	await client.end();
}
