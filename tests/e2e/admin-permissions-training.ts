import type postgres from 'postgres';

/* A course with a topic, a lesson and a question for admin-permissions.spec.ts: every training
 * action could really run on them. */
export type TrainingIds = {
	courseId: string;
	topicId: string;
	lessonId: string;
	questionId: string;
	accessId: string;
};

export const trainingPath = (path: string, ids: TrainingIds) =>
	path
		.replace('/training/[id]', `/training/${ids.courseId}`)
		.replace('/lessons/[lessonId]', `/lessons/${ids.lessonId}`)
		.replace('/questions/[questionId]', `/questions/${ids.questionId}`);

export function trainingFixtures(sql: postgres.Sql) {
	return {
		insertTraining: async (): Promise<TrainingIds> => {
			const [course] = await sql`insert into courses (slug, exam_kind, title)
				values (${`e2e-perm-${crypto.randomUUID().slice(0, 8)}`}, 'trainer',
					${sql.json({ en: 'E2e perm course' })}) returning id`;
			const [topic] = await sql`insert into course_topics (course_id, title)
				values (${course.id}, ${sql.json({ en: 'E2e perm topic' })}) returning id`;
			const [lesson] = await sql`insert into course_lessons (course_id, topic_id, title)
				values (${course.id}, ${topic.id}, ${sql.json({ en: 'E2e perm lesson' })}) returning id`;
			const [question] = await sql`insert into quiz_questions
					(course_id, topic_id, text, options, correct_index)
				values (${course.id}, ${topic.id}, ${sql.json({ en: 'E2e perm question' })},
					${sql.json([{ en: 'No' }, { en: 'Yes' }])}, 1) returning id`;
			const [applicant] = await sql`insert into users (email, name, birth_date)
				values (${`e2e-perm-applicant-${crypto.randomUUID()}@example.com`}, 'Perm Applicant',
					'1990-01-01') returning id`;
			const [access] = await sql`insert into course_access (course_id, user_id)
				values (${course.id}, ${applicant.id}) returning id`;
			return {
				courseId: course.id,
				topicId: topic.id,
				lessonId: lesson.id,
				questionId: question.id,
				accessId: access.id
			};
		},
		trainingRows: async (ids: TrainingIds) => ({
			course: (await sql`select * from courses where id = ${ids.courseId}`)[0],
			topics: await sql`select * from course_topics where course_id = ${ids.courseId} order by id`,
			lessons:
				await sql`select * from course_lessons where course_id = ${ids.courseId} order by id`,
			questions:
				await sql`select * from quiz_questions where course_id = ${ids.courseId} order by id`,
			access: await sql`select * from course_access where id = ${ids.accessId}`,
			created: await sql`select slug from courses where slug like 'e2e-hostile-%'`,
			audit: await sql`select 1 from audit_log where entity_id in
				(${ids.courseId}, ${ids.topicId}, ${ids.lessonId}, ${ids.questionId}, ${ids.accessId})`
		})
	};
}
