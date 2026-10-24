/*
 * Every admin action that changes data and the audit codes it writes (docs/02 section 10,
 * docs/04 sections 2 and 6). Key: route id and form action, or method and endpoint.
 * A new admin action must be added here, or the coverage test fails.
 */
export const ADMIN_AUDIT = {
	'/admin/users/[id]?/update': ['user.update'],
	'/admin/users/[id]?/role': ['user.role_change'],
	'/admin/users/[id]?/block': ['user.block'],
	'/admin/users/[id]?/unblock': ['user.unblock'],
	'/admin/users/[id]?/confirmEmail': ['user.email_confirm'],
	'/admin/users/[id]?/passwordLink': ['user.password_link'],
	'/admin/users/new?/default': ['user.create'],
	'/admin/roles?/grant': ['user.role_change'],
	'/admin/roles?/revoke': ['user.role_change'],
	'/admin/settings?/default': ['settings.update'],
	'/admin/settings/payments?/default': ['settings.update'],
	'/admin/media?/complete': ['media.upload'],
	'/admin/media/[id]?/alt': ['media.update'],
	'/admin/media/[id]?/delete': ['media.delete'],
	'/admin/pages/new?/default': ['page.create'],
	'/admin/pages/[id]?/update': ['page.update'],
	'/admin/pages/[id]?/delete': ['page.delete'],
	'/admin/news/new?/default': ['post.create'],
	'/admin/news/[id]?/update': ['post.update'],
	'/admin/news/[id]?/status': ['post.update'],
	'/admin/news/[id]?/duplicate': ['post.create'],
	'/admin/news/[id]?/delete': ['post.delete'],
	'/admin/events/new?/default': ['event.create'],
	'/admin/events/[id]?/update': ['event.update'],
	'/admin/events/[id]?/categoryCreate': ['event_category.create'],
	'/admin/events/[id]?/categoryUpdate': ['event_category.update'],
	'/admin/events/[id]?/categoryDelete': ['event_category.delete'],
	'/admin/events/[id]?/status': ['event.update'],
	'/admin/events/[id]?/duplicate': ['event.create'],
	'/admin/events/[id]?/cancel': ['event.cancel'],
	'/admin/events/[id]?/finish': ['event.update'],
	'/admin/events/[id]?/archive': ['event.update'],
	'/admin/events/[id]?/restore': ['event.update'],
	'/admin/events/[id]?/delete': ['event.delete'],
	'/admin/hero/new?/default': ['hero.create'],
	'/admin/hero/[id]?/update': ['hero.update'],
	'/admin/hero?/toggle': ['hero.activate', 'hero.deactivate'],
	'/admin/hero?/reorder': ['hero.reorder'],
	'/admin/hero/[id]?/duplicate': ['hero.duplicate'],
	'/admin/hero/[id]?/archive': ['hero.archive'],
	'/admin/hero/[id]?/restore': ['hero.restore'],
	'/admin/payments/new?/default': ['payment.confirm_manual'],
	'/admin/payments/[id]?/confirm': ['payment.confirm_manual'],
	'/admin/payments/[id]?/refund': ['payment.refund'],
	'/admin/payments/[id]?/resolve': ['payment.review_resolved'],
	'/admin/payments/[id]?/receipt': ['payment.receipt_resend'],
	'/admin/points/new?/default': ['points.adjust'],
	'/admin/points?/reverse': ['points.reverse'],
	'/admin/point-rules/[id]?/default': ['points.rule_update'],
	'/admin/point-rules?/thresholds': ['settings.update'],
	'/admin/donation-purposes/new?/default': ['donation_purpose.create'],
	'/admin/donation-purposes/[id]?/update': ['donation_purpose.update'],
	'/admin/consents/[id]?/approve': ['consent.approve'],
	'/admin/consents/[id]?/reject': ['consent.reject'],
	'/admin/registrations/[id]?/promote': ['registration.promote'],
	'/admin/registrations/[id]?/cancel': ['registration.cancel'],
	'/admin/registrations/[id]?/add': ['registration.add'],
	'/admin/registrations/[id]/day?/mark': ['registration.attendance'],
	'/admin/registrations/[id]/results?/save': ['registration.result'],
	'/admin/registrations/[id]/results?/finish': ['event.update'],
	'/admin/exams/new?/default': ['exam.schedule'],
	'/admin/exams/[id]?/result': ['exam.result'],
	'/admin/certificates/new?/default': ['certificate.issue', 'user.level'],
	'/admin/certificates/[id]?/pdf': ['certificate.pdf'],
	'/admin/certificates/[id]?/revoke': ['certificate.revoke']
} as const;

export type AdminAction = keyof typeof ADMIN_AUDIT;

/* Admin endpoints that change nothing of the federation, with the reason. */
export const NOT_AUDITED = {
	'POST /admin/locale': 'own interface language of the staff member',
	'/admin/media?/sign':
		'only issues an upload link; the file enters the library at complete (media.upload)'
} as const satisfies Record<string, string>;

export type NotAuditedAction = keyof typeof NOT_AUDITED;
