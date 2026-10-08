import sanitizeHtml from 'sanitize-html';
import { mimeOfKey } from '#lib/validation/media.ts';

/*
 * docs/05 section 18: editor HTML is cleaned on save by an allow-list. Links — http(s), mailto or a
 * site path; images — only library images from our storage; iframes — only a YouTube player whose
 * address is rebuilt from the video id, so nothing from the original address survives.
 */

const SAFE_REL = 'noopener noreferrer';
const LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);
const YOUTUBE_HOSTS = new Set([
	'www.youtube.com',
	'youtube.com',
	'www.youtube-nocookie.com',
	'youtube-nocookie.com'
]);
const YOUTUBE_PATH = /^\/embed\/([\w-]{6,20})$/;

function safeHref(href: string): boolean {
	if (/^\/(?![/\\])/.test(href)) return true;
	try {
		return LINK_PROTOCOLS.has(new URL(href).protocol);
	} catch {
		return false;
	}
}

function libraryImage(src: string, mediaBaseUrl: string | null): boolean {
	if (!mediaBaseUrl) return false;
	const prefix = `${mediaBaseUrl.replace(/\/+$/, '')}/`;
	if (!src.startsWith(prefix)) return false;
	return mimeOfKey(src.slice(prefix.length))?.startsWith('image/') ?? false;
}

function youtubeEmbed(src: string): string | null {
	let url: URL;
	try {
		url = new URL(src);
	} catch {
		return null;
	}
	if (url.protocol !== 'https:' || !YOUTUBE_HOSTS.has(url.hostname)) return null;
	const id = YOUTUBE_PATH.exec(url.pathname)?.[1];
	return id && id !== 'videoseries' ? `https://www.youtube-nocookie.com/embed/${id}` : null;
}

/** A tag outside `allowedTags`: dropped, its text kept. */
const unwrap = (): sanitizeHtml.Tag => ({ tagName: 'unwrap', attribs: {} });
const ALLOWED_TAGS = ['h2', 'h3', 'p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'blockquote'];

export function sanitizeRichText(html: string, opts: { mediaBaseUrl: string | null }): string {
	return sanitizeHtml(html, {
		allowedTags: [...ALLOWED_TAGS, 'a', 'img', 'div', 'iframe'],
		allowedAttributes: {
			a: ['href', 'target', 'rel'],
			img: ['src', 'alt'],
			div: ['data-youtube-video'],
			iframe: ['src', 'width', 'height', 'allowfullscreen', 'loading', 'referrerpolicy']
		},
		allowedSchemes: ['http', 'https', 'mailto'],
		allowedSchemesByTag: { img: ['https'], iframe: ['https'] },
		allowProtocolRelative: false,
		nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript', 'template'],
		transformTags: {
			h1: 'h2',
			h4: 'h3',
			b: 'strong',
			i: 'em',
			a: (_, attribs) => {
				const href = attribs.href ?? '';
				if (!safeHref(href)) return unwrap();
				const link: sanitizeHtml.Attributes = { href };
				if (attribs.target === '_blank') link.target = '_blank';
				return { tagName: 'a', attribs: { ...link, rel: SAFE_REL } };
			},
			img: (_, attribs) => {
				const src = attribs.src ?? '';
				if (!libraryImage(src, opts.mediaBaseUrl)) return unwrap();
				return { tagName: 'img', attribs: { src, alt: attribs.alt ?? '' } };
			},
			iframe: (_, attribs) => {
				const src = youtubeEmbed(attribs.src ?? '');
				if (!src) return unwrap();
				return {
					tagName: 'iframe',
					attribs: {
						src,
						width: '640',
						height: '360',
						allowfullscreen: 'true',
						loading: 'lazy',
						referrerpolicy: 'strict-origin-when-cross-origin'
					}
				};
			}
		},
		exclusiveFilter: (frame) =>
			frame.tag === 'div' && 'data-youtube-video' in frame.attribs && !frame.mediaChildren.length
	});
}
