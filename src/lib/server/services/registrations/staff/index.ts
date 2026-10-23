import { PUBLIC_SITE_URL } from '$app/env/private';
import type { LimitDb } from '../../../auth/rate-limit';
import { sendMail } from '../../../mail';
import type { Actor } from '../../users/target';
import { registrationSettings } from '../settings';
import { cancelRegistrationByStaff, type StaffCancelResult } from './cancel';
import type { RegistrationRef } from './lock';
import { promoteRegistration, type PromoteResult } from './promote';

/* docs/05 section 5, tab "Registrations": routes call these; letters go after the commit. */

export { addRegistration, type AddRefusal, type AddResult } from './add';
export { registrationsCsv } from './export';
export {
	listRegistrations,
	registrationCounts,
	registrationListOptions,
	registrationsForExport,
	type StaffRegistrationRow
} from './list';
export type { PromoteResult, StaffCancelResult };

const deps = async (db: LimitDb) => ({
	settings: await registrationSettings(db),
	send: sendMail,
	siteUrl: PUBLIC_SITE_URL
});

export async function promoteNow(
	db: LimitDb,
	actor: Actor,
	ref: RegistrationRef,
	ip: string | null
): Promise<PromoteResult> {
	return promoteRegistration(db, actor, ref, await deps(db), ip);
}

export async function cancelByStaffNow(
	db: LimitDb,
	actor: Actor,
	ref: RegistrationRef & { reason: string },
	ip: string | null
): Promise<StaffCancelResult> {
	return cancelRegistrationByStaff(db, actor, ref, await deps(db), ip);
}
