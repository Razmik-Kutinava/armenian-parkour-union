import { and, eq } from 'drizzle-orm';
import type { QuestionValues } from '#lib/validation/training-questions.ts';
import type { CourseValues, LessonValues } from '#lib/validation/training.ts';
import type { LimitDb } from '../../auth/rate-limit';
import type { UserRole } from '../../auth/session';
import { memberships } from '../../db/schema/payments';
import { auditLog, siteSettings } from '../../db/schema/service';
import { courses, courseTopics } from '../../db/schema/training';
import { courseAccess } from '../../db/schema/training-progress';
import { insertUser } from '../../db/test-db';
import type { Mail } from '../../mail/resend';
import { applyForCourse } from './access';

/* Test support only: training rows and actors. */

export const IP = '10.0.0.9';
export const PDF = new TextEncoder().encode('%PDF-1.7\n%aaIO\n');

export async function staff(tx: LimitDb, role: UserRole = 'admin') {
	const { id } = await insertUser(tx, { role });
	return { id, role };
}

export const courseValues = (extra: Partial<CourseValues> = {}): CourseValues => ({
	slug: `t-course-${crypto.randomUUID().slice(0, 8)}`,
	examKind: 'trainer',
	title: { en: 'Coach course', ru: 'Курс тренера' },
	description: { en: 'Theory, quiz and practice' },
	status: 'draft',
	quizSize: 27,
	passCount: 25,
	quizMinutes: 60,
	retakeDays: 30,
	attemptsLimit: 3,
	attemptsPeriodDays: 180,
	requiresMembership: true,
	minAge: 18,
	requiredLevel: 'advanced',
	...extra
});

export const lessonValues = (extra: Partial<LessonValues> = {}): LessonValues => ({
	topicId: null,
	title: { en: 'Safety first' },
	body: { en: '<p>Warm up</p>' },
	sortOrder: 0,
	status: 'draft',
	...extra
});

export const questionValues = (
	topicId: string,
	extra: Partial<QuestionValues> = {}
): QuestionValues => ({
	topicId,
	text: { ru: 'Сколько вопросов в тесте Maddocks?' },
	options: [{ ru: '3' }, { ru: '5' }, { ru: '10' }],
	correctIndex: 1,
	source: null,
	...extra
});

export async function insertCourse(tx: LimitDb) {
	const v = courseValues();
	const [row] = await tx
		.insert(courses)
		.values({ slug: v.slug, examKind: v.examKind, title: v.title })
		.returning({ id: courses.id });
	return row.id;
}

export async function insertTopic(tx: LimitDb, courseId: string, sortOrder = 0) {
	const [row] = await tx
		.insert(courseTopics)
		.values({ courseId, title: { en: `Topic ${sortOrder}` }, sortOrder })
		.returning({ id: courseTopics.id });
	return row.id;
}

/** A published course with the coach conditions (membership, 18+, advanced) unless overridden. */
export async function insertOpenCourse(
	tx: LimitDb,
	extra: Partial<typeof courses.$inferInsert> = {}
) {
	const [row] = await tx
		.insert(courses)
		.values({
			slug: `t-open-${crypto.randomUUID().slice(0, 8)}`,
			examKind: 'trainer',
			title: { ru: 'Курс тренера', en: 'Coach course' },
			status: 'published',
			requiresMembership: true,
			minAge: 18,
			requiredLevel: 'advanced',
			...extra
		})
		.returning({ id: courses.id, slug: courses.slug });
	return row;
}

type MemberOptions = Parameters<typeof insertUser>[1] & { member?: boolean };

/** A member who meets the coach conditions unless overridden; `member: false` — no membership. */
export async function applicant(tx: LimitDb, { member = true, ...values }: MemberOptions = {}) {
	const user = await insertUser(tx, { birthDate: '1990-01-01', level: 'advanced', ...values });
	if (member) {
		const day = 86_400_000;
		await tx.insert(memberships).values({
			userId: user.id,
			status: 'active',
			startsAt: new Date(Date.now() - 10 * day),
			endsAt: new Date(Date.now() + 300 * day)
		});
	}
	return user;
}

/** The federation address for letters to the admin (`site_settings.contacts.email`). */
export async function setFederationEmail(tx: LimitDb, email: string | null) {
	const value = email ? { email } : {};
	await tx
		.insert(siteSettings)
		.values({ key: 'contacts', value })
		.onConflictDoUpdate({ target: siteSettings.key, set: { value } });
}

/** Letters the code tried to send; `failing` throws like an unreachable mail service. */
export function mailbox(failing = false) {
	const sent: Mail[] = [];
	const send = async (mail: Mail) => {
		if (failing) throw new Error('mail is down');
		sent.push(mail);
	};
	return { sent, send };
}

export const SITE = 'https://parkour.test';
export const accessDeps = (send: (mail: Mail) => Promise<void>) => ({ send, siteUrl: SITE, ip: IP });

export const accessRow = async (tx: LimitDb, id: string) =>
	(await tx.select().from(courseAccess).where(eq(courseAccess.id, id)))[0];

/** A pending request of a member who meets the coach conditions (unless overridden). */
export async function applied(tx: LimitDb, values: MemberOptions = {}) {
	const course = await insertOpenCourse(tx);
	const user = await applicant(tx, values);
	const result = await applyForCourse(tx, user.id, course.id, accessDeps(mailbox().send));
	if (!result.ok) throw new Error(result.reason);
	return { course, user, id: result.id };
}

export const auditOf = (tx: LimitDb, entityType: string, id: string) =>
	tx
		.select()
		.from(auditLog)
		.where(and(eq(auditLog.entityType, entityType), eq(auditLog.entityId, id)))
		.orderBy(auditLog.createdAt);
