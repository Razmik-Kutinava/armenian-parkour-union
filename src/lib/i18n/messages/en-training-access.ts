/** Admin "Training": access requests and their letters (docs/05 section 27, docs/03 section 18.6). Part of `enTrainingAdmin`. */
export const enTrainingAccess = {
	'admin.nav.trainingAccess': 'Requests',
	'training.access.empty': 'No requests found',
	'training.access.filter.course': 'Course',
	'training.access.filter.allCourses': 'All courses',
	'training.access.filter.status': 'Status',
	'training.access.status.all': 'All',
	'training.access.status.pending': 'Pending',
	'training.access.status.approved': 'Approved',
	'training.access.status.rejected': 'Rejected',
	'training.access.status.revoked': 'Access closed',
	'training.access.col.member': 'Member',
	'training.access.col.course': 'Course',
	'training.access.col.date': 'Date',
	'training.access.col.status': 'Status',
	'training.access.col.age': 'Age',
	'training.access.col.level': 'Level',
	'training.access.col.paidUntil': 'Member until',
	'training.access.col.actions': 'Decision',
	'training.access.none': '—',
	'training.access.approve': 'Approve',
	'training.access.reject': 'Reject',
	'training.access.revoke': 'Close access',
	'training.access.search': 'Member name',
	'training.access.rejectTitle': 'Reject the request',
	'training.access.rejectText':
		'The member gets an email with the reason and can apply again. The reason is shown in the cabinet.',
	'training.access.revokeTitle': 'Close access to the course',
	'training.access.revokeText':
		'The portal closes for the member; attempts and videos stay in the history. The member gets an email with the reason and cannot apply again.',
	'training.access.done.approve': 'Request approved, the member is notified by email.',
	'training.access.done.reject': 'Request rejected, the member is notified by email.',
	'training.access.done.revoke': 'Access closed, the member is notified by email.',
	'training.access.error.reason': 'Enter a reason, up to 1000 characters.',
	'training.access.error.state': 'The request has already been decided. Reload the page.',
	'training.access.extra': 'Extra attempt',
	'training.access.extraTitle': 'Grant an extra quiz attempt',
	'training.access.extraText':
		'The member can take the quiz once more without the pause and the attempts limit. The action is logged.',
	'training.access.extraUnused': 'Extra attempts not used: {count}',
	'training.access.done.extra': 'Extra attempt granted.',
	'training.access.error.extraState':
		'An extra attempt is possible only for an approved request while the quiz is not passed. Reload the page.',
	'training.access.error.conditions':
		'The member no longer meets the course conditions ({missing}). Reject the request or wait.',
	'training.missing.membership': 'valid membership',
	'training.missing.age': 'age',
	'training.missing.level': 'level',
	'training.mail.request.subject': 'New course access request',
	'training.mail.request.text':
		'{name} asks for access to the course “{course}”.\n\nRequests: {url}',
	'training.mail.approved.subject': 'Access to the course is open',
	'training.mail.approved.text':
		'Hello, {name}!\n\nYour request for the course “{course}” is approved.\n\nCourse portal: {url}',
	'training.mail.rejected.subject': 'Course access request declined',
	'training.mail.rejected.text':
		'Hello, {name}!\n\nYour request for the course “{course}” is declined. Reason: {reason}\n\nYou can apply again: {url}',
	'training.mail.revoked.subject': 'Access to the course is closed',
	'training.mail.revoked.text':
		'Hello, {name}!\n\nYour access to the course “{course}” is closed. Reason: {reason}\n\nTraining: {url}'
} as const;
