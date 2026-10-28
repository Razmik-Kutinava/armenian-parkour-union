/** Cabinet "Training": practice videos and the decision letter (docs/06 section 5.11, docs/03 section 18.6). Part of `enCabinet`. */
export const enCabinetPractice = {
	'cabinet.practice.title': 'Practice',
	'cabinet.practice.go': 'Go to the practice',
	'cabinet.practice.progress': 'Accepted: {accepted} of {total}.',
	'cabinet.practice.state.open': 'Send a video link for each task.',
	'cabinet.practice.state.quiz': 'Practice opens after the quiz is passed.',
	'cabinet.practice.state.finished': 'Course completed.',
	'cabinet.practice.state.preview': 'Preview: practice is taken only with an approved request.',
	'cabinet.practice.empty': 'No tasks yet.',
	'cabinet.practice.link': 'Video link (YouTube or Google Drive)',
	'cabinet.practice.hint':
		'Upload the video with access by link (YouTube “Unlisted” or Google Drive “Anyone with the link”) and paste the link. Files are not accepted.',
	'cabinet.practice.send': 'Send for review',
	'cabinet.practice.replace': 'Replace the link',
	'cabinet.practice.status.pending': 'Under review',
	'cabinet.practice.status.approved': 'Accepted',
	'cabinet.practice.status.rejected': 'Returned',
	'cabinet.practice.note': 'Comment: {note}',
	'cabinet.practice.history': 'Submissions',
	'cabinet.practice.video': 'Video',
	'cabinet.practice.sent': 'The link is sent for review.',
	'cabinet.practice.replaced': 'The link is replaced.',
	'cabinet.practice.error.bad_url': 'Paste a link to a YouTube video or a Google Drive file.',
	'cabinet.practice.error.quiz': 'Practice opens after the quiz is passed.',
	'cabinet.practice.error.finished': 'The course is already completed.',
	'cabinet.practice.error.bad_state': 'This task is already accepted.',
	'cabinet.practice.error.preview': 'Preview: practice is taken only with an approved request.',
	'cabinet.action.retake':
		'A practice video of the course “{course}” was returned: retake the task.',
	'cabinet.practice.retakeGo': 'To the practice',
	'training.mail.practiceApproved.subject': 'Practice video accepted',
	'training.mail.practiceApproved.text':
		'Hello, {name}!\n\nYour video for the task “{task}” of the course “{course}” is accepted.\n\nPractice: {url}',
	'training.mail.practiceRejected.subject': 'Practice video returned',
	'training.mail.practiceRejected.text':
		'Hello, {name}!\n\nYour video for the task “{task}” of the course “{course}” is returned. Comment: {note}\n\nRecord it again and send a new link: {url}',
	'training.mail.practiceComment': 'Comment: {note}'
} as const;
