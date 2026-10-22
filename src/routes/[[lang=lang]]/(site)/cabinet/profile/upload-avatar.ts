import { deserialize } from '$app/forms';
import type { MessageKey } from '#lib/i18n/translate.ts';
import { AVATAR_MAX_BYTES, isAvatarMime } from '#lib/validation/avatar.ts';

/** Same limits as the server, only to answer at once; the server checks again. */
function precheck(file: File): MessageKey | null {
	if (!isAvatarMime(file.type)) return 'cabinet.avatar.type';
	if (file.size === 0) return 'cabinet.avatar.empty';
	if (file.size > AVATAR_MAX_BYTES) return 'cabinet.avatar.size';
	return null;
}

async function action(name: 'avatarSign' | 'avatarComplete', fields: Record<string, string>) {
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
	(result.type === 'failure' &&
		(result.data as { avatar?: { message?: MessageKey } })?.avatar?.message) ||
	'cabinet.avatar.failed';

/** Signed link from the server → PUT straight to the bucket → the server checks the file. */
export async function uploadAvatar(file: File): Promise<MessageKey | null> {
	const early = precheck(file);
	if (early) return early;
	const signed = await action('avatarSign', { mime: file.type, size: String(file.size) });
	if (signed.type !== 'success') return messageOf(signed);
	const { key, url } = signed.data as { key: string; url: string };
	const put = await fetch(url, {
		method: 'PUT',
		body: file,
		headers: { 'content-type': file.type }
	});
	if (!put.ok) return 'cabinet.avatar.failed';
	const done = await action('avatarComplete', { key });
	return done.type === 'success' ? null : messageOf(done);
}
