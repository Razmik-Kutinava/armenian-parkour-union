// npx tsx scripts/import-quiz-bank.ts --file=training/trainer/quiz-bank.json [--dry]
// Actor: TRAINING_ACTOR_EMAIL ?? SEED_ADMIN_EMAIL (an active admin), like fill-system-pages.ts.
// Imports a prepared question bank (roadmap 9.3) through the admin services, so every row is in the
// audit log. The file stays outside git. The whole file is checked first; one transaction — all or
// nothing. A repeat adds only new questions (same text — skipped); edits go through the admin panel.
import { existsSync, readFileSync } from 'node:fs';
import { and, eq, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users } from '../src/lib/server/db/schema/users';
import { importQuizBank } from '../src/lib/server/services/training/question-import';
import { quizBankFileSchema } from '../src/lib/validation/training-questions';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const arg = (name: string) =>
	process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const { DATABASE_URL } = process.env;
const file = arg('file');
const actorEmail = process.env.TRAINING_ACTOR_EMAIL ?? process.env.SEED_ADMIN_EMAIL;
if (!DATABASE_URL || !file || !actorEmail) {
	throw new Error(
		'DATABASE_URL, --file and TRAINING_ACTOR_EMAIL (or SEED_ADMIN_EMAIL) are required'
	);
}
const dry = process.argv.includes('--dry');

const parsed = quizBankFileSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')));
if (!parsed.success) {
	for (const issue of parsed.error.issues)
		console.error(`${issue.path.join('.')}: ${issue.message}`);
	throw new Error(`${file}: the bank file is not valid, nothing imported`);
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
	const report = await importQuizBank(db, actor, parsed.data, { dry, ip: null });
	console.log(dry ? 'dry run, nothing written:' : 'imported:', report);
} finally {
	await client.end();
}
