import { z } from 'zod';
import type { MessageKey } from '#lib/i18n/translate.ts';
import { yerevanDay } from './admin-payments';
import {
	CERTIFICATE_CATEGORY_MAX,
	CERTIFICATE_COMMENT_MAX,
	CERTIFICATE_KINDS,
	CERTIFICATE_LEVELS,
	REVOKE_REASON_MAX
} from './certificate-enums';

/* Admin forms "Certificates" (docs/05 section 8). Messages are i18n keys; the service checks the
 * level order, the exam and the expiry against the issue date. */

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `YYYY-MM-DD` → Yerevan midnight (no daylight saving: +04:00); null for a day that does not exist. */
function yerevanMidnight(value: string): Date | null {
	const m = DAY.exec(value);
	if (!m) return null;
	const utc = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
	if (utc.getUTCMonth() !== +m[2] - 1 || utc.getUTCDate() !== +m[3]) return null;
	return new Date(`${value}T00:00:00+04:00`);
}

const text = (max: number) =>
	z
		.string()
		.trim()
		.max(max, { error: 'auth.error.tooLong' })
		.optional()
		.transform((v) => v || null);

const optionalDay = (error: MessageKey) =>
	z
		.string()
		.trim()
		.optional()
		.refine((v) => !v || yerevanMidnight(v) !== null, { error });

export function issueSchema(now: Date = new Date()) {
	const today = yerevanDay(now);
	return z
		.object({
			userId: z.uuid({ error: 'certificates.error.member' }),
			kind: z.enum(CERTIFICATE_KINDS, { error: 'certificates.error.kind' }),
			level: z.string().optional(),
			category: text(CERTIFICATE_CATEGORY_MAX),
			examId: z
				.string()
				.trim()
				.optional()
				.transform((v) => v || null)
				.pipe(z.uuid({ error: 'certificates.error.exam' }).nullable()),
			issuedAt: optionalDay('certificates.error.issuedAt').refine((v) => !v || v <= today, {
				error: 'certificates.error.issuedAt'
			}),
			expiresAt: optionalDay('certificates.error.expiresAt'),
			comment: text(CERTIFICATE_COMMENT_MAX)
		})
		.transform((f, ctx) => {
			const isLevel = f.kind === 'level';
			const level = CERTIFICATE_LEVELS.find((l) => l === f.level) ?? null;
			if (isLevel && !level) {
				ctx.addIssue({ code: 'custom', path: ['level'], message: 'certificates.error.level' });
			}
			return {
				userId: f.userId,
				kind: f.kind,
				level: isLevel ? level : null,
				category: isLevel ? null : f.category,
				examId: f.examId,
				/** Empty or today — now (the service default). */
				issuedAt: f.issuedAt && f.issuedAt !== today ? yerevanMidnight(f.issuedAt) : null,
				expiresAt: !isLevel && f.expiresAt ? yerevanMidnight(f.expiresAt) : null,
				comment: f.comment
			};
		});
}

/** The reason is the comment of the confirm dialog (docs/05 section 1, item 7). */
export const revokeSchema = z.object({
	comment: z
		.string({ error: 'auth.error.required' })
		.trim()
		.min(1, { error: 'auth.error.required' })
		.max(REVOKE_REASON_MAX, { error: 'auth.error.tooLong' })
});
