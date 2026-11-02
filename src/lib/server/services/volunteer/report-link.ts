import { normalizeVideoUrl } from '../videos/link';
import { normalizePracticeUrl } from '../training/practice-link';

/* docs/03 section 19.7 p. 2: Instagram, YouTube or Google Drive — one stored https form. */

/** Normalized https link; `null` — not an allowed platform. */
export function normalizeReportUrl(raw: string): string | null {
	const video = normalizeVideoUrl(raw, ['youtube', 'instagram']);
	if (video) return video.url;
	return normalizePracticeUrl(raw)?.url ?? null;
}
