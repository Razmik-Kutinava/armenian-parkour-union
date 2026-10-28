/** Training: the course finished — letters, the exam notes, progress in the course list (docs/03 section 18.5, docs/06 section 5.11). Part of `enCabinet`. */
export const enTrainingComplete = {
	'cabinet.training.quizPassed': 'Quiz: passed.',
	'cabinet.training.quizNotPassed': 'Quiz: not passed yet.',
	'cabinet.training.quizRetake': 'Quiz: not passed, a retake from {date}.',
	'cabinet.training.practiceProgress': 'Practice: accepted {accepted} of {total}.',
	'cabinet.training.certified': 'Course completed, the certificate is issued.',
	'cabinet.training.toCertificate': 'Open the certificate',
	'training.exam.notes': 'Training portal: quiz {correct}/{total}, practice {accepted}/{tasks}',
	'training.mail.courseFinished.subject': 'Course completed: the distance part',
	'training.mail.courseFinished.text':
		'Hello, {name}!\n\nYou have completed the distance part of the course “{course}”: the quiz is passed and every practice video is accepted. This admits you to the in-person stages of the attestation (see the attestation regulations on the portal). The federation issues the certificate after the in-person stages — you will be contacted about them, and you will get a separate letter when the certificate is issued.\n\nCourses: {url}',
	'training.mail.courseFinishedAdmin.subject':
		'Course completed — admitted to the in-person stages',
	'training.mail.courseFinishedAdmin.text':
		'{name} has completed the distance part of the course “{course}”: a passed exam is created. After the in-person stages of the attestation, issue the certificate from the exam card: {url}'
} as const;
