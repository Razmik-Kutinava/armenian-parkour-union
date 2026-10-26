import type { LimitDb } from '../../auth/rate-limit';
import { checkStaffAdmission, type AdmissionInput, type Refusal } from './admission';
import { readAdmission, readMember } from './admission-data';

/* docs/03 sections 7.2, 15 (owner 2026-10-26): a seat from the waitlist goes only to a member who
 * would be admitted now — a consent, a membership or the account may have changed while they
 * waited. The registration window does not apply: they are already in line. */

type EventRef = AdmissionInput['event'] & { id: string };
type Queued = { userId: string; categoryId: string | null };

/** `null` — admitted. The caller holds the event and registration locks. */
export async function promotionRefusal(
	tx: LimitDb,
	event: EventRef,
	row: Queued,
	now: Date
): Promise<Refusal | 'user_not_found' | null> {
	const user = await readMember(tx, row.userId);
	if (!user) return 'user_not_found';
	const { facts } = await readAdmission(tx, event.id, row.userId, now, false);
	return checkStaffAdmission({
		now,
		event,
		user,
		categoryId: row.categoryId,
		...facts,
		existing: null
	});
}
