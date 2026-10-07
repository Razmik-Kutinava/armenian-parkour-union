import { z } from 'zod';

/* docs/05 section 20; types and size — decisions.md 2026-10-07. No SVG: it may carry a script. */

export const MEDIA_MAX_BYTES = 10 * 1024 * 1024;
export const mediaTypes = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp',
	'image/avif': 'avif',
	'application/pdf': 'pdf'
} as const;
export type MediaMime = keyof typeof mediaTypes;
export const mediaMimes = Object.keys(mediaTypes) as MediaMime[];
export const mediaKinds = ['image', 'pdf'] as const;

export const isMediaMime = (mime: string): mime is MediaMime => mime in mediaTypes;

/** Enough of the file start for every signature below. */
export const SNIFF_BYTES = 16;
const ascii = (bytes: Uint8Array, from: number, text: string) =>
	[...text].every((c, i) => bytes[from + i] === c.charCodeAt(0));

/** The real type by the first bytes; the browser's declared type is not trusted. */
export function sniffMime(b: Uint8Array): MediaMime | null {
	if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
	if (b[0] === 0x89 && ascii(b, 1, 'PNG\r\n\x1a\n')) return 'image/png';
	if (ascii(b, 0, 'RIFF') && ascii(b, 8, 'WEBP')) return 'image/webp';
	if (ascii(b, 4, 'ftyp') && (ascii(b, 8, 'avif') || ascii(b, 8, 'avis'))) return 'image/avif';
	if (ascii(b, 0, '%PDF-')) return 'application/pdf';
	return null;
}

const KEY =
	/^media\/\d{4}\/\d{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(\w+)$/;

/** `media/YYYY/MM/<uuid>.<ext>`: the name in storage never comes from the user. */
export function mediaKey(mime: MediaMime, now = new Date()): string {
	const month = String(now.getUTCMonth() + 1).padStart(2, '0');
	return `media/${now.getUTCFullYear()}/${month}/${crypto.randomUUID()}.${mediaTypes[mime]}`;
}

export function mimeOfKey(key: string): MediaMime | null {
	const ext = KEY.exec(key)?.[1];
	return mediaMimes.find((m) => mediaTypes[m] === ext) ?? null;
}

const fileName = z
	.string()
	.transform((s) => s.replace(/[\p{Cc}/\\]/gu, '').trim())
	.pipe(
		z.string().min(1, { error: 'auth.error.required' }).max(200, { error: 'auth.error.tooLong' })
	);

export const uploadRequestSchema = z.object({
	name: fileName,
	mime: z.enum(mediaMimes, { error: 'media.error.type' }),
	size: z.coerce
		.number()
		.int()
		.min(1, { error: 'media.error.empty' })
		.max(MEDIA_MAX_BYTES, { error: 'media.error.size' })
});
export type UploadRequest = z.output<typeof uploadRequestSchema>;

export const completeSchema = z.object({ key: z.string().max(200), name: fileName });

const altText = z
	.string()
	.trim()
	.max(300, { error: 'auth.error.tooLong' })
	.optional()
	.transform((s) => s || undefined);

/** Alt per language, all optional (decorative images keep it empty, docs/08); all blank → null. */
export const altSchema = z.object({ en: altText, hy: altText, ru: altText }).transform((alt) => {
	const filled = Object.fromEntries(Object.entries(alt).filter(([, v]) => v));
	return Object.keys(filled).length > 0
		? (filled as Partial<Record<'en' | 'hy' | 'ru', string>>)
		: null;
});
export type AltText = z.output<typeof altSchema>;
