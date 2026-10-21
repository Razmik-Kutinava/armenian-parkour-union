import { error } from '@sveltejs/kit';
import type { MessageKey } from '#lib/i18n/translate.ts';
import type { PointsRefusal } from '#lib/server/services/points/support.ts';

const messages: Record<Exclude<PointsRefusal, 'not_allowed'>, MessageKey> = {
	invalid: 'points.error.comment',
	not_found: 'points.error.notFound',
	insufficient_balance: 'points.error.insufficient',
	not_reversible: 'points.error.notReversible',
	already_reversed: 'points.error.alreadyReversed'
};

/** A refusal of the points service as a message; a missing right — 403 without details. */
export function refusalMessage(reason: PointsRefusal): MessageKey {
	if (reason === 'not_allowed') error(403, 'Forbidden');
	return messages[reason];
}
