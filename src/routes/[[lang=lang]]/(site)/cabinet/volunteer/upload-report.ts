import { deserialize } from '$app/forms';
import type { MessageKey } from '#lib/i18n/translate.ts';
import { REPORT_MAX_BYTES, isReportMime } from '#lib/validation/volunteer-report.ts';

function precheck(file: File): MessageKey | null {
	if (!isReportMime(file.type)) return 'cabinet.volunteer.report.type';
	if (file.size === 0) return 'cabinet.volunteer.report.empty';
	if (file.size > REPORT_MAX_BYTES) return 'cabinet.volunteer.report.size';
	return null;
}

/** Signed link → PUT to the private bucket → returns the key for `?/report`. */
export async function uploadReportPhoto(
	file: File
): Promise<{ ok: true; key: string } | { ok: false; message: MessageKey }> {
	const early = precheck(file);
	if (early) return { ok: false, message: early };
	const body = new FormData();
	body.set('mime', file.type);
	body.set('size', String(file.size));
	const res = await fetch('?/reportSign', {
		method: 'POST',
		body,
		headers: { 'x-sveltekit-action': 'true' }
	});
	const signed = deserialize(await res.text());
	if (signed.type !== 'success') {
		return {
			ok: false,
			message:
				(signed.type === 'failure' &&
					(signed.data as { report?: { message?: MessageKey } })?.report?.message) ||
				'cabinet.volunteer.report.error'
		};
	}
	const { key, url } = (signed.data as { reportSign: { key: string; url: string } }).reportSign;
	const put = await fetch(url, {
		method: 'PUT',
		body: file,
		headers: { 'content-type': file.type }
	});
	if (!put.ok) return { ok: false, message: 'cabinet.volunteer.report.error' };
	return { ok: true, key };
}
