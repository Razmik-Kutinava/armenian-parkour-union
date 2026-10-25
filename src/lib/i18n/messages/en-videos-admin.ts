/** Admin "Videos" moderation and the video settings (docs/05 sections 11, 21). Part of `en`. */
export const enVideosAdmin = {
	'videos.status.hidden': 'Hidden',
	'videos.platform.youtube': 'YouTube',
	'videos.platform.instagram': 'Instagram',
	'videos.platform.tiktok': 'TikTok',
	'videos.platform.other': 'Other',
	'videos.admin.search': 'Search by name',
	'videos.admin.filter.all': 'All',
	'videos.admin.col.member': 'Member',
	'videos.admin.col.video': 'Video',
	'videos.admin.col.platform': 'Platform',
	'videos.admin.col.event': 'Event',
	'videos.admin.col.createdAt': 'Added',
	'videos.admin.col.status': 'Status',
	'videos.admin.col.actions': 'Actions',
	'videos.admin.untitled': 'Untitled video',
	'videos.admin.openHint': 'Opens on the platform in a new tab',
	'videos.admin.approve': 'Approve',
	'videos.admin.reject': 'Reject',
	'videos.admin.hide': 'Hide',
	'videos.admin.selected': 'Selected: {count}',
	'videos.admin.approveSelected': 'Approve selected',
	'videos.admin.rejectSelected': 'Reject selected',
	'videos.admin.hideSelected': 'Hide selected',
	'videos.admin.rejectTitle': 'Reject videos: {count}',
	'videos.admin.rejectText':
		'The member gets a letter with the reason. No points are given for a rejected video.',
	'videos.admin.result': 'Done: {done}. Skipped: {skipped}.',
	'videos.admin.skippedHint':
		'Skipped: already decided, not approved yet (for hiding), your own video, or a deleted account.',
	'videos.admin.empty': 'No videos here.',
	'videos.admin.error.select': 'Choose at least one video.',
	'videos.admin.error.tooMany': 'Up to 25 videos at a time.',
	'videos.admin.error.reason': 'Enter the reason for the refusal.',
	'videos.mail.approved.subject': 'Your video is approved',
	'videos.mail.approved.text':
		'Hello, {name}!\n\nYour video "{title}" is approved by a moderator.\n\nYour videos: {url}',
	'videos.mail.approved.textPoints':
		'Hello, {name}!\n\nYour video "{title}" is approved by a moderator. You get {points} points.\n\nYour videos: {url}',
	'videos.mail.rejected.subject': 'Your video is not approved',
	'videos.mail.rejected.text':
		'Hello, {name}!\n\nYour video "{title}" is not approved. Reason: {reason}\n\nYour videos: {url}',
	'settings.tab.videos': 'Videos',
	'videos.settings.section': 'Member videos',
	'videos.settings.sectionHint':
		'Rejected videos count towards the limit; videos the member deleted do not. The month is the calendar month in Yerevan.',
	'videos.settings.limit': 'Videos a month',
	'videos.settings.limitHint': 'How many videos one member may add in a month, from 1 to 100.',
	'videos.settings.platforms': 'Accepted platforms',
	'videos.settings.error.limit': 'From 1 to 100.',
	'videos.settings.error.platforms': 'Choose at least one platform.'
} as const;
