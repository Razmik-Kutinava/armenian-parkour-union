/* decisions.md 2026-10-08 (2.6): YouTube — picture and player on click; Instagram — a link. */

export type VideoLink = { kind: 'youtube'; id: string } | { kind: 'instagram'; url: string };

const YOUTUBE_ID = /^[\w-]{11}$/;
const YOUTUBE_HOSTS = new Set([
	'www.youtube.com',
	'youtube.com',
	'm.youtube.com',
	'www.youtube-nocookie.com',
	'youtube-nocookie.com'
]);
const INSTAGRAM_HOSTS = new Set(['www.instagram.com', 'instagram.com']);

const youtube = (id: string): VideoLink | null =>
	YOUTUBE_ID.test(id) ? { kind: 'youtube', id } : null;

/** Only https links of YouTube videos and Instagram posts or reels; anything else is `null`. */
export function parseVideoUrl(raw: string): VideoLink | null {
	let url: URL;
	try {
		url = new URL(raw.trim());
	} catch {
		return null;
	}
	if (url.protocol !== 'https:') return null;
	if (url.hostname === 'youtu.be') return youtube(url.pathname.slice(1));
	if (YOUTUBE_HOSTS.has(url.hostname)) {
		if (url.pathname === '/watch') return youtube(url.searchParams.get('v') ?? '');
		const path = /^\/(?:shorts|embed)\/([^/]+)\/?$/.exec(url.pathname);
		return path ? youtube(path[1]) : null;
	}
	if (INSTAGRAM_HOSTS.has(url.hostname)) {
		const path = /^\/(p|reel)\/([\w-]+)\/?$/.exec(url.pathname);
		return path
			? { kind: 'instagram', url: `https://www.instagram.com/${path[1]}/${path[2]}/` }
			: null;
	}
	return null;
}

export const youtubeThumbUrl = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
export const youtubeEmbedUrl = (id: string) =>
	`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
