import { parseVideoUrl } from '#lib/components/site/hero/youtube.ts';

/* docs/03 section 8 p. 1–2: YouTube and Instagram only; one video under different links is one link. */

export type VideoPlatform = 'youtube' | 'instagram';

/** The stored form of an allowed link; `null` — another platform, a switched-off one or not a video. */
export function normalizeVideoUrl(
	raw: string,
	platforms: readonly VideoPlatform[]
): { platform: VideoPlatform; url: string } | null {
	const link = parseVideoUrl(raw);
	if (!link || !platforms.includes(link.kind)) return null;
	return link.kind === 'youtube'
		? { platform: 'youtube', url: `https://www.youtube.com/watch?v=${link.id}` }
		: { platform: 'instagram', url: link.url };
}
