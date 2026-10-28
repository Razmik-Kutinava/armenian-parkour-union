import { parseVideoUrl } from '#lib/components/site/hero/youtube.ts';
import type { practicePlatforms } from '../../db/schema/training-progress';

/* docs/03 section 18.4 p. 2: YouTube (unlisted too) or a Google Drive file, never an upload; one video
 * under different links is one link. Decisions — docs/todo.md 9.7 (2). */

export type PracticePlatform = (typeof practicePlatforms)[number];

const DRIVE_ID = /^[\w-]{10,}$/;

function driveId(url: URL): string | null {
	if (url.hostname !== 'drive.google.com') return null;
	const file = /^\/file\/d\/([^/]+)(?:\/[^/]*)?\/?$/.exec(url.pathname);
	const id = file
		? file[1]
		: /^\/(?:open|uc)$/.test(url.pathname)
			? url.searchParams.get('id')
			: null;
	return id && DRIVE_ID.test(id) ? id : null;
}

/** The stored form; `null` — not an https YouTube video or Google Drive file. */
export function normalizePracticeUrl(
	raw: string
): { platform: PracticePlatform; url: string } | null {
	const video = parseVideoUrl(raw);
	if (video?.kind === 'youtube') {
		return { platform: 'youtube', url: `https://www.youtube.com/watch?v=${video.id}` };
	}
	let url: URL;
	try {
		url = new URL(raw.trim());
	} catch {
		return null;
	}
	if (url.protocol !== 'https:') return null;
	const id = driveId(url);
	return id
		? { platform: 'google_drive', url: `https://drive.google.com/file/d/${id}/view` }
		: null;
}
