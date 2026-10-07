import { deserialize } from '$app/forms';
import type { MessageKey } from '#lib/i18n/translate.ts';
import { MEDIA_MAX_BYTES, isMediaMime } from '#lib/validation/media.ts';

/** Same limits as the server, only to answer at once; the server checks again. */
export function precheck(file: File): MessageKey | null {
	if (!isMediaMime(file.type)) return 'media.error.type';
	if (file.size > MEDIA_MAX_BYTES) return 'media.error.size';
	if (file.size === 0) return 'media.error.empty';
	return null;
}

async function action(name: 'sign' | 'complete', fields: Record<string, string>) {
	const body = new FormData();
	for (const [key, value] of Object.entries(fields)) body.set(key, value);
	const res = await fetch(`/admin/media?/${name}`, {
		method: 'POST',
		body,
		headers: { 'x-sveltekit-action': 'true' }
	});
	return deserialize(await res.text());
}

const messageOf = (result: { type: string; data?: unknown }): MessageKey =>
	(result.type === 'failure' && (result.data as { message?: MessageKey })?.message) ||
	'media.error.failed';

/** docs/05 section 20: signed link from the server → PUT straight to R2 → server checks the file. */
export async function uploadFile(file: File): Promise<MessageKey | null> {
	const signed = await action('sign', {
		name: file.name,
		mime: file.type,
		size: String(file.size)
	});
	if (signed.type !== 'success') return messageOf(signed);
	const { key, url } = signed.data as { key: string; url: string };
	const put = await fetch(url, {
		method: 'PUT',
		body: file,
		headers: { 'content-type': file.type }
	});
	if (!put.ok) return 'media.error.failed';
	const done = await action('complete', { key, name: file.name });
	return done.type === 'success' ? null : messageOf(done);
}
