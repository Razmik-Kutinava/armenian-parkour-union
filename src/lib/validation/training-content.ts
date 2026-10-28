import { z } from 'zod';
import { portalText } from './portal-text';
import { lessonFormSchema } from './training';
import { taskFormSchema } from './training-practice';

/* The prepared course content file (roadmap 9.9; docs/todo.md 9.9, decision 5): the texts are the
 * fields of the admin forms, cleaned the same way; a lesson or a task without text is refused. */

const notEmpty = { error: 'media.error.empty' };
const filled = (text: object) => Object.keys(text).length > 0;

export const courseContentSchema = (mediaBaseUrl: string | null) => {
	const lesson = lessonFormSchema(mediaBaseUrl).shape;
	const task = taskFormSchema(mediaBaseUrl).shape;
	return z.object({
		topics: z
			.array(
				z.object({
					title: portalText(200),
					lessons: z
						.array(z.object({ title: lesson.title, body: lesson.body.refine(filled, notEmpty) }))
						.min(1)
				})
			)
			.min(1),
		practiceTasks: z.array(
			z.object({ title: task.title, description: task.description.refine(filled, notEmpty) })
		)
	});
};
export type CourseContent = z.output<ReturnType<typeof courseContentSchema>>;
