// Runs in production (Fly release_command) without drizzle-kit: only drizzle-orm + postgres.
import { existsSync } from 'node:fs';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const migrationsFolder = './drizzle';

if (!existsSync(`${migrationsFolder}/meta/_journal.json`)) {
	console.log('No migrations yet — skipped');
	process.exit(0);
}

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const client = postgres(process.env.DATABASE_URL, { max: 1 });
await migrate(drizzle(client), { migrationsFolder });
await client.end();
console.log('Migrations applied');
