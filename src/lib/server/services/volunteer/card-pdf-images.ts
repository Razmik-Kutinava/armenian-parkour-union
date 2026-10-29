import { MEDIA } from '#lib/components/site/media-photo.ts';
import { sniffMime } from '#lib/validation/media.ts';

/* docs/todo.md 10.4 (4): pdf-lib embeds JPEG and PNG only, avatars and logos may be WebP or AVIF, and
 * no image library is added. A library picture is asked from Cloudflare Image Transformations as
 * JPEG (white under transparency); another host — the original if it is JPEG or PNG. A picture that
 * does not come leaves its place empty: the PDF is still made. */

export type PdfImage = { bytes: Uint8Array; type: 'jpeg' | 'png' };
export type ImageFetch = (url: string, init: { signal: AbortSignal }) => Promise<Response>;

const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 5_000;
export const PHOTO_WIDTH = 600;
export const LOGO_WIDTH = 200;

const variant = (url: string, width: number) =>
	`${MEDIA}cdn-cgi/image/width=${width},fit=scale-down,format=jpeg,background=white/${url.slice(MEDIA.length)}`;

async function get(url: string, fetcher: ImageFetch, timeoutMs: number): Promise<PdfImage | null> {
	try {
		const res = await fetcher(url, { signal: AbortSignal.timeout(timeoutMs) });
		if (!res.ok) return null;
		const bytes = new Uint8Array(await res.arrayBuffer());
		if (bytes.length > MAX_BYTES) return null;
		const mime = sniffMime(bytes);
		if (mime === 'image/jpeg') return { bytes, type: 'jpeg' };
		if (mime === 'image/png') return { bytes, type: 'png' };
		return null;
	} catch {
		return null;
	}
}

export async function loadPdfImage(
	url: string | null,
	width: number,
	fetcher: ImageFetch = fetch,
	timeoutMs = TIMEOUT_MS
): Promise<PdfImage | null> {
	if (!url) return null;
	const resized = url.startsWith(MEDIA) ? await get(variant(url, width), fetcher, timeoutMs) : null;
	return resized ?? (await get(url, fetcher, timeoutMs));
}

/** The photo and each distinct logo, in parallel; `toUrl` — the public address of a stored key. */
export async function loadCardImages(
	keys: { avatarKey: string | null; logoKeys: (string | null)[] },
	toUrl: (key: string) => string | null,
	fetcher: ImageFetch = fetch
): Promise<{ photo: PdfImage | null; logos: Map<string, PdfImage> }> {
	const url = (key: string | null) => (key ? toUrl(key) : null);
	const logoKeys = [...new Set(keys.logoKeys.filter((k): k is string => Boolean(k)))];
	const [photo, ...logos] = await Promise.all([
		loadPdfImage(url(keys.avatarKey), PHOTO_WIDTH, fetcher),
		...logoKeys.map((key) => loadPdfImage(url(key), LOGO_WIDTH, fetcher))
	]);
	if (!photo && keys.avatarKey) console.warn('volunteer card PDF: the photo did not load');
	const found = new Map<string, PdfImage>();
	logoKeys.forEach((key, i) => {
		const logo = logos[i];
		if (logo) found.set(key, logo);
	});
	return { photo, logos: found };
}
