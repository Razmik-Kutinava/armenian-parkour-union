/** Replace short brand in site_settings.requisites. Safe to re-run. */
import { existsSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const client = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
try {
	const db = drizzle(client);
	await db.execute(sql`
		update site_settings
		set
			value = replace(value::text, 'Armenian Parkour Union', 'Armenian Parkour Federation')::jsonb,
			updated_at = now()
		where key = 'requisites'
			and value::text like '%Armenian Parkour Union%'
	`);
	console.log('requisites updated');
} finally {
	await client.end();
}
