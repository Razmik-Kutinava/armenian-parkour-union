import { z } from 'zod';
import { email } from './auth';

/* Admin forms of the points ledger (docs/05 section 12, docs/03 section 6.3). Messages are i18n keys.
 * Client-safe: the list page takes the reasons from here, not from the server schema. */

export const POINTS_REASONS = [
	'certificate',
	'event_registration',
	'event_participation',
	'event_place',
	'video',
	'manual',
	'shop_order',
	'shop_refund',
	'reversal',
	'volunteer_participation',
	'volunteer_report'
] as const;
export type PointsReason = (typeof POINTS_REASONS)[number];

const INT_MAX = 2_147_483_647;

const comment = z
	.string({ error: 'auth.error.required' })
	.trim()
	.min(1, { error: 'auth.error.required' })
	.max(1000, { error: 'auth.error.tooLong' });

/** A whole number of points, plus adds and minus takes; zero changes nothing. */
const delta = z
	.string({ error: 'points.error.delta' })
	.trim()
	.regex(/^[+-]?\d{1,10}$/, { error: 'points.error.delta' })
	.transform(Number)
	.refine((n) => n !== 0 && Math.abs(n) <= INT_MAX, { error: 'points.error.delta' });

export const adjustSchema = z.object({
	userId: z.uuid({ error: 'points.error.member' }),
	delta,
	comment
});

export const reverseSchema = z.object({ entryId: z.uuid(), comment });

export const memberQuerySchema = z.object({ email });
