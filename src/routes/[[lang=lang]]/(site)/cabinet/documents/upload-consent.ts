import { deserialize } from '$app/forms';
import type { MessageKey } from '#lib/i18n/translate.ts';
import { yerevanDay } from '#lib/validation/admin-payments.ts';
import { CONSENT_MAX_BYTES, isConsentMime, type ConsentKind } from '#lib/validation/consents.ts';

/** Same limits as the server, only to answer at once; the server checks again. */
function precheck(file: File | undefined, signedOn: string): MessageKey | null {
	if (!signedOn || signedOn > yerevanDay(new Date())) return 'consents.error.signedOn';
	if (!file) return 'consents.error.empty';
	if (!isConsentMime(file.type)) return 'consents.error.type';
	if (file.size === 0) return 'consents.error.empty';
	if (file.size > CONSENT_MAX_BYTES) return 'consents.error.size';
	return null;
}

async function action(name: 'consentSign' | 'consentComplete', fields: Record<string, string>) {
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
		(result.data as { consent?: { message?: MessageKey } })?.consent?.message) ||
	'consents.error.failed';

/** Signed link from the server → PUT straight to the private bucket → the server checks the file. */
export async function uploadConsent(
	kind: ConsentKind,
	file: File | undefined,
	signedOn: string
): Promise<MessageKey | null> {
	const early = precheck(file, signedOn);
	if (early || !file) return early;
	const signed = await action('consentSign', { kind, mime: file.type, size: String(file.size) });
	if (signed.type !== 'success') return messageOf(signed);
	const { key, url } = signed.data as { key: string; url: string };
	const put = await fetch(url, {
		method: 'PUT',
		body: file,
		headers: { 'content-type': file.type }
	});
	if (!put.ok) return 'consents.error.failed';
	const done = await action('consentComplete', { kind, key, signedOn });
	return done.type === 'success' ? null : messageOf(done);
}
