import { z } from 'zod';
import { mediaTypes } from './media';

/* docs/02 section 12, docs/03 section 19.7 p. 2: private photo for a volunteer report. */

export const REPORT_MAX_BYTES = 10 * 1024 * 1024;
export const reportMimes = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type ReportMime = (typeof reportMimes)[number];

export const isReportMime = (mime: string): mime is ReportMime =>
	(reportMimes as readonly string[]).includes(mime);

export const reportUploadSchema = z.object({
	mime: z.enum(reportMimes, { error: 'cabinet.volunteer.report.type' }),
	size: z.coerce
		.number()
		.int()
		.min(1, { error: 'cabinet.volunteer.report.empty' })
		.max(REPORT_MAX_BYTES, { error: 'cabinet.volunteer.report.size' })
});
export type ReportUploadRequest = z.output<typeof reportUploadSchema>;

/** `volunteer/<user id>/<uuid>.<ext>` — docs/02 section 12. */
export const reportKey = (userId: string, mime: ReportMime) =>
	`volunteer/${userId}/${crypto.randomUUID()}.${mediaTypes[mime]}`;

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const KEY = new RegExp(`^volunteer/(${UUID})/${UUID}\\.(\\w+)$`);

export function reportMimeOfKey(userId: string, key: string): ReportMime | null {
	const match = KEY.exec(key);
	if (!match || match[1] !== userId) return null;
	return reportMimes.find((m) => mediaTypes[m] === match[2]) ?? null;
}
