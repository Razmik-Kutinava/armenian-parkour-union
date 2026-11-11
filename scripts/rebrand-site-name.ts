/** Update site_name + page bodies Union → Federation. Safe to re-run (dev or prod URL). */
import { existsSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const NAME = {
	en: 'Armenian Parkour Federation',
	hy: 'Հայաստանի պարկուրի ֆեդերացիա',
	ru: 'Федерация паркура Армении'
};

const client = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
try {
	const db = drizzle(client);
	await db.execute(sql`
		update site_settings
		set value = ${JSON.stringify(NAME)}::jsonb, updated_at = now()
		where key = 'site_name'
	`);
	const pages = await db.execute(sql`
		update pages
		set
			body = replace(
				replace(
					replace(body::text, 'Armenian Parkour Union', 'Armenian Parkour Federation'),
					'Союз паркура Армении',
					'Федерация паркура Армении'
				),
				'Հայաստանի պարկուրի միություն',
				'Հայաստանի պարկուրի ֆեդերացիա'
			)::jsonb,
			updated_at = now()
		where body::text like '%Armenian Parkour Union%'
			or body::text like '%Союз паркура Армении%'
			or body::text like '%պարկուրի միություն%'
		returning slug
	`);
	console.log('site_name updated');
	console.log('pages', pages);
} finally {
	await client.end();
}
