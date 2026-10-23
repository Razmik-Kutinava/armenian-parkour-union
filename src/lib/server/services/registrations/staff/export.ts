import { pickLocalized } from '#lib/i18n/localized.ts';
import type { Locale } from '#lib/i18n/locales.ts';
import { toCsv } from '../../audit-csv';
import type { StaffRegistrationRow } from './list';

/* docs/05 section 5: CSV of the event registrations with the filters of the list. */

export { registrationsForExport } from './list';

/** `contacts`: the email column, only for a viewer with `users.read_full` (docs/04 section 4). */
export function registrationsCsv(
	rows: StaffRegistrationRow[],
	locale: Locale,
	contacts: boolean
): string {
	const header = [
		'registration_id',
		'user_id',
		'name',
		...(contacts ? ['email'] : []),
		'age',
		'category',
		'status',
		'paid',
		'registered_at',
		'attended_at',
		'place',
		'score',
		'result_note'
	];
	return toCsv(
		header,
		rows.map((r) => [
			r.id,
			r.userId,
			r.name,
			...(contacts ? [r.email] : []),
			r.age,
			r.categoryName ? pickLocalized(r.categoryName, locale) : null,
			r.status,
			r.paid,
			r.registeredAt,
			r.attendedAt,
			r.place,
			r.score,
			r.resultNote
		])
	);
}
