// npx tsx scripts/fill-system-pages.ts [--publish] [--dry] [--overwrite=privacy,rules] — writes the
// texts of the system pages through the admin service (cleaning + audit log). A page that already
// has text is skipped unless it is listed in --overwrite (that replaces edits made in the admin panel).
import { existsSync } from 'node:fs';
import { and, eq, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { pages } from '../src/lib/server/db/schema/content';
import { users } from '../src/lib/server/db/schema/users';
import { PAGE_TEXTS } from '../src/lib/server/seed/page-texts';
import { SEED_PAGES } from '../src/lib/server/seed/pages';
import { updatePage } from '../src/lib/server/services/pages/edit';
import { pageFormSchema, type PageStatus } from '../src/lib/validation/pages';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const { DATABASE_URL, R2_PUBLIC_URL } = process.env;
const actorEmail = process.env.PAGES_ACTOR_EMAIL ?? process.env.SEED_ADMIN_EMAIL;
if (!DATABASE_URL || !actorEmail)
	throw new Error('DATABASE_URL and PAGES_ACTOR_EMAIL are required');
const publish = process.argv.includes('--publish');
const dry = process.argv.includes('--dry');
const overwriteArg = process.argv.find((a) => a.startsWith('--overwrite='));
const overwrite = new Set(overwriteArg?.slice('--overwrite='.length).split(',').filter(Boolean));
for (const slug of overwrite) {
	if (!(slug in PAGE_TEXTS)) throw new Error(`--overwrite: unknown system page ${slug}`);
}

const client = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });
try {
	const db = drizzle(client);
	const [actor] = await db
		.select({ id: users.id, role: users.role })
		.from(users)
		.where(
			and(
				eq(users.email, actorEmail.toLowerCase()),
				eq(users.role, 'admin'),
				isNull(users.deletedAt)
			)
		);
	if (!actor) throw new Error(`no active admin ${actorEmail}`);
	for (const [slug, body] of Object.entries(PAGE_TEXTS)) {
		const [page] = await db
			.select()
			.from(pages)
			.where(and(eq(pages.slug, slug), eq(pages.isSystem, true), isNull(pages.deletedAt)));
		if (!page) throw new Error(`${slug}: no system page, run db:seed first`);
		if (Object.values(page.body as object).some(Boolean) && !overwrite.has(slug)) {
			console.log(`${slug}: already has text, skipped`);
			continue;
		}
		const status: PageStatus = publish ? 'published' : page.status;
		const title = { ...SEED_PAGES[slug], ...(page.title as object) };
		const values = pageFormSchema(R2_PUBLIC_URL ?? null).parse({ slug, title, body, status });
		const result = dry ? 'dry run' : await updatePage(db, actor, page.id, values, null);
		console.log(`${slug}: ${result}, status ${status}`);
	}
} finally {
	await client.end();
}
