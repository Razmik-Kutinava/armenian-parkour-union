/** Training: the course finished — letters, the exam notes, progress in the course list (docs/03 section 18.5, docs/06 section 5.11). Part of `enCabinet`. */
export const enTrainingComplete = {
	'cabinet.training.quizPassed': 'Quiz: passed.',
	'cabinet.training.quizNotPassed': 'Quiz: not passed yet.',
	'cabinet.training.quizRetake': 'Quiz: not passed, a retake from {date}.',
	'cabinet.training.practiceProgress': 'Practice: accepted {accepted} of {total}.',
	'cabinet.training.certified': 'Course completed, the certificate is issued.',
	'cabinet.training.toCertificate': 'Open the certificate',
	'training.exam.notes': 'Training portal: quiz {correct}/{total}, practice {accepted}/{tasks}',
	'training.mail.courseFinished.subject': 'Course completed',
	'training.mail.courseFinished.text':
		'Hello, {name}!\n\nYou have completed the course “{course}”: the quiz is passed and every practice video is accepted. The course is waiting for the certificate — the federation will issue it, and you will get a separate letter.\n\nCourses: {url}',
	'training.mail.courseFinishedAdmin.subject': 'Course completed — a certificate to issue',
	'training.mail.courseFinishedAdmin.text':
		'{name} has completed the course “{course}”: a passed exam is created. Issue the certificate from the exam card: {url}'
} as const;
