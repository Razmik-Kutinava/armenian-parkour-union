import { deserialize } from '$app/forms';
import type { MessageKey } from '#lib/i18n/translate.ts';
import { LESSON_PDF_MAX_BYTES } from '#lib/validation/training-enums.ts';

const PDF = 'application/pdf';

/** Same limits as the server, only to answer at once; the server checks the bytes again. */
export function precheck(file: File): MessageKey | null {
	if (file.type !== PDF) return 'training.error.pdfType';
	if (file.size > LESSON_PDF_MAX_BYTES) return 'training.error.pdfSize';
	if (file.size === 0) return 'media.error.empty';
	return null;
}

async function action(name: 'pdfSign' | 'pdfComplete', fields: Record<string, string>) {
	const body = new FormData();
	for (const [key, value] of Object.entries(fields)) body.set(key, value);
	const res = await fetch(`?/${name}`, {
		method: 'POST',
		body,
		headers: { 'x-sveltekit-action': 'true' }
	});
	return deserialize(await res.text());
}

const messageOf = (result: { type: string; data?: unknown }): MessageKey =>
	(result.type === 'failure' && (result.data as { message?: MessageKey })?.message) ||
	'training.error.pdfFailed';

/** docs/05 section 27: signed link from the server → PUT straight to R2 → the server checks the file. */
export async function uploadPdf(file: File): Promise<MessageKey | null> {
	const signed = await action('pdfSign', { mime: file.type, size: String(file.size) });
	if (signed.type !== 'success') return messageOf(signed);
	const { key, url } = signed.data as { key: string; url: string };
	const put = await fetch(url, { method: 'PUT', body: file, headers: { 'content-type': PDF } });
	if (!put.ok) return 'training.error.pdfFailed';
	const done = await action('pdfComplete', { key, name: file.name });
	return done.type === 'success' ? null : messageOf(done);
}
