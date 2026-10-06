import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { building } from '$app/env';
import { DATABASE_URL } from '$app/env/private';
import * as schema from './schema';

if (!DATABASE_URL && !building) throw new Error('DATABASE_URL is not set');

// postgres.js connects lazily, so the build step never opens a connection.
const client = DATABASE_URL ? postgres(DATABASE_URL) : postgres();

export const db = drizzle(client, { schema });
