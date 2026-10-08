import { z } from 'zod';
import { sanitizeRichText } from './sanitize';

/** Editor HTML limit, checked before cleaning (about 30 pages of text). */
export const RICH_TEXT_MAX = 200_000;

/** No text and no image or video: an untouched editor is stored as an empty string. */
const isBlank = (html: string) =>
	!/<(img|iframe)\b/.test(html) &&
	html
		.replace(/<[^>]*>/g, '')
		.replace(/&nbsp;|&#160;/g, '')
		.trim() === '';

/** A rich text form field: the HTML from the browser is never stored as sent. */
export const richTextSchema = (mediaBaseUrl: string | null) =>
	z
		.string()
		.max(RICH_TEXT_MAX, { error: 'auth.error.tooLong' })
		.transform((html) => {
			const clean = sanitizeRichText(html, { mediaBaseUrl });
			return isBlank(clean) ? '' : clean;
		});
