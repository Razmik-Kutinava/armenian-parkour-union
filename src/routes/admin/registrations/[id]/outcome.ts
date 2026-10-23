import { error, fail } from '@sveltejs/kit';
import type { MessageKey } from '#lib/i18n/translate.ts';
import type {
	AddRefusal,
	PromoteResult,
	StaffCancelResult
} from '#lib/server/services/registrations/staff/index.ts';

/* Service results → the page message; a missing event or registration is a 404. */

type Refusal = Exclude<PromoteResult | StaffCancelResult | AddRefusal, 'ok'>;

const ERRORS: Partial<Record<Refusal, MessageKey>> = {
	full: 'registrationsAdmin.error.full',
	wrong_status: 'registrationsAdmin.error.changed',
	event_closed: 'registrationsAdmin.error.event_closed',
	not_open: 'registrationsAdmin.error.event_closed',
	closed: 'registrationsAdmin.error.event_closed',
	user_not_found: 'registrationsAdmin.error.user_not_found',
	no_reason: 'registrationsAdmin.error.no_reason',
	already_registered: 'registrationsAdmin.refused.already_registered',
	blocked: 'registrationsAdmin.refused.blocked',
	email_unverified: 'registrationsAdmin.refused.email_unverified',
	no_membership: 'registrationsAdmin.refused.no_membership',
	category_required: 'registrationsAdmin.refused.category_required',
	category_invalid: 'registrationsAdmin.refused.category_invalid',
	birth_date_required: 'registrationsAdmin.refused.birth_date_required',
	parental_consent: 'registrationsAdmin.refused.parental_consent',
	age_mismatch: 'registrationsAdmin.refused.age_mismatch'
};

export function refused(reason: Refusal) {
	if (reason === 'not_found') error(404, 'Not found');
	if (reason === 'not_allowed') error(403, 'Forbidden');
	return fail(400, { message: ERRORS[reason] ?? 'registrationsAdmin.error.changed' });
}

export const done = (message: MessageKey) => ({ done: message });
