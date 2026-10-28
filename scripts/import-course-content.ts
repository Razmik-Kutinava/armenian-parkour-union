// npx tsx scripts/import-course-content.ts --manifest=training/trainer-course/manifest.json --course=trainer [--dry]
// Actor: TRAINING_ACTOR_EMAIL ?? SEED_ADMIN_EMAIL (an active admin), like import-quiz-bank.ts.
// Loads lessons and practice tasks prepared outside git (roadmap 9.9) into an existing course
// (made by import-quiz-bank.ts) through the admin services, so every row is in the audit log.
// Lessons are drafts. The whole file is checked first; one transaction — all or nothing.
// A repeat adds only new lessons and tasks (same title — skipped); edits go through the admin panel.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { and, eq, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users } from '../src/lib/server/db/schema/users';
import { importCourseContent } from '../src/lib/server/services/training/content-import';
import { courseContentSchema } from '../src/lib/validation/training-content';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const arg = (name: string) =>
	process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const { DATABASE_URL, R2_PUBLIC_URL } = process.env;
const manifestFile = arg('manifest');
const slug = arg('course');
const actorEmail = process.env.TRAINING_ACTOR_EMAIL ?? process.env.SEED_ADMIN_EMAIL;
if (!DATABASE_URL || !manifestFile || !slug || !actorEmail) {
	throw new Error(
		'DATABASE_URL, --manifest, --course and TRAINING_ACTOR_EMAIL (or SEED_ADMIN_EMAIL) are required'
	);
}
const dry = process.argv.includes('--dry');

type Entry = { file: string; title: string };
type Manifest = {
	language: string;
	topics: { title: string; lessons: Entry[] }[];
	practiceTasks: Entry[];
};
const manifest = JSON.parse(readFileSync(manifestFile, 'utf8')) as Manifest;
const lang = manifest.language;
if (!['en', 'hy', 'ru'].includes(lang)) throw new Error(`${manifestFile}: language ${lang}`);
const text = (value: string) => ({ [lang]: value });
const html = (entry: Entry) => readFileSync(join(dirname(manifestFile), entry.file), 'utf8');

const parsed = courseContentSchema(R2_PUBLIC_URL || null).safeParse({
	topics: manifest.topics.map((topic) => ({
		title: text(topic.title),
		lessons: topic.lessons.map((l) => ({ title: text(l.title), body: text(html(l)) }))
	})),
	practiceTasks: manifest.practiceTasks.map((t) => ({
		title: text(t.title),
		description: text(html(t))
	}))
});
if (!parsed.success) {
	for (const issue of parsed.error.issues)
		console.error(`${issue.path.join('.')}: ${issue.message}`);
	throw new Error(`${manifestFile}: the content is not valid, nothing imported`);
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
	const report = await importCourseContent(db, actor, slug, parsed.data, { dry, ip: null });
	if (report === 'not_found') throw new Error(`no course ${slug}: run import-quiz-bank.ts first`);
	console.log(dry ? 'dry run, nothing written:' : 'imported:', report);
} finally {
	await client.end();
}
