import { describe, expect, it } from 'vitest';
import { sanitizeRichText } from './sanitize';

const BASE = 'https://media.parkour.am';
const KEY = 'media/2026/10/0b5c6a2e-1f3d-4c8e-9a7b-2d4e6f8a0c1e';
const IMG = `${BASE}/${KEY}.webp`;
const clean = (html: string) => sanitizeRichText(html, { mediaBaseUrl: BASE });

describe('sanitizeRichText: allowed formatting (docs/05 section 18)', () => {
	it('keeps headings, bold, italic, lists, quotes as they are', () => {
		const html =
			'<h2>Title</h2><h3>Sub</h3><p><strong>b</strong> <em>i</em><br />x</p>' +
			'<ul><li><p>a</p></li></ul><ol><li><p>b</p></li></ol><blockquote><p>q</p></blockquote>';
		expect(clean(html)).toBe(html);
	});

	it('maps pasted h1, b, i to the allowed tags', () => {
		expect(clean('<h1>T</h1><p><b>b</b><i>i</i></p>')).toBe(
			'<h2>T</h2><p><strong>b</strong><em>i</em></p>'
		);
	});

	it('drops unknown tags but keeps their text', () => {
		expect(clean('<p><span>a</span><u>b</u><font>c</font></p>')).toBe('<p>abc</p>');
	});

	it('drops comments, style and class attributes', () => {
		expect(clean('<!-- x --><p class="c" style="color:red" id="i">a</p>')).toBe('<p>a</p>');
	});
});

describe('sanitizeRichText: dangerous code is removed', () => {
	it.each([
		['<p>a</p><script>alert(1)</script>', '<p>a</p>'],
		['<p>a</p><style>p{}</style>', '<p>a</p>'],
		['<p onclick="alert(1)" onmouseover="x">a</p>', '<p>a</p>'],
		['<svg onload="alert(1)"><script>alert(1)</script></svg><p>a</p>', '<p>a</p>'],
		['<form action="https://evil"><input name="p"><button>go</button></form>', 'go'],
		['<object data="x"></object><embed src="x"><p>a</p>', '<p>a</p>'],
		['<math><mi xlink:href="javascript:alert(1)">x</mi></math>', 'x'],
		['<noscript><p title="</noscript><img src=x onerror=alert(1)>">', '']
	])('%s', (input, expected) => {
		expect(clean(input)).toBe(expected);
	});

	it.each([
		'javascript:alert(1)',
		'JaVaScRiPt:alert(1)',
		'&#106;avascript:alert(1)',
		' javascript:alert(1)',
		'java\tscript:alert(1)',
		'data:text/html;base64,PHNjcmlwdD4=',
		'vbscript:x',
		'//evil.example/x'
	])('link with href %s loses the link, keeps the text', (href) => {
		expect(clean(`<p><a href="${href}">x</a></p>`)).toBe('<p>x</p>');
	});
});

describe('sanitizeRichText: links', () => {
	it('keeps https and mailto links and forces a safe rel', () => {
		expect(clean('<p><a href="https://fiv.am/x?a=1" target="_blank" rel="opener">x</a></p>')).toBe(
			'<p><a href="https://fiv.am/x?a=1" target="_blank" rel="noopener noreferrer">x</a></p>'
		);
		expect(clean('<p><a href="mailto:info@parkour.am">m</a></p>')).toBe(
			'<p><a href="mailto:info@parkour.am" rel="noopener noreferrer">m</a></p>'
		);
	});

	it('drops a target other than _blank', () => {
		expect(clean('<p><a href="https://a.am" target="evil">x</a></p>')).toBe(
			'<p><a href="https://a.am" rel="noopener noreferrer">x</a></p>'
		);
	});
});

describe('sanitizeRichText: images only from the media library', () => {
	it('keeps a library image with alt', () => {
		expect(clean(`<p><img src="${IMG}" alt="Jump" title="t" onerror="x"></p>`)).toBe(
			`<p><img src="${IMG}" alt="Jump" /></p>`
		);
	});

	it.each([
		['another host', `https://evil.example/${KEY}.webp`],
		['host with our host as prefix', `https://media.parkour.am.evil.example/${KEY}.webp`],
		['path outside media', `${BASE}/other/x.webp`],
		['path traversal', `${BASE}/media/2026/10/../../../x.webp`],
		['a PDF from the library', `${BASE}/${KEY}.pdf`],
		['query string', `${IMG}?x=1`],
		['data URL', 'data:image/png;base64,iVBORw0KGgo='],
		['javascript', 'javascript:alert(1)']
	])('removes an image from %s', (_, src) => {
		expect(clean(`<p>a<img src="${src}" alt="x"></p>`)).toBe('<p>a</p>');
	});

	it('removes every image while storage is not connected', () => {
		expect(sanitizeRichText(`<p>a<img src="${IMG}"></p>`, { mediaBaseUrl: null })).toBe('<p>a</p>');
	});
});

describe('sanitizeRichText: YouTube video only', () => {
	const embed = (id: string) =>
		`<div data-youtube-video=""><iframe src="https://www.youtube-nocookie.com/embed/${id}" width="640" height="360" allowfullscreen="true" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;

	it.each([
		'https://www.youtube.com/embed/dQw4w9WgXcQ',
		'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
		'https://youtube.com/embed/dQw4w9WgXcQ?autoplay=1&origin=https://evil.example'
	])('rebuilds the player address from %s', (src) => {
		expect(
			clean(
				`<div data-youtube-video="" class="x"><iframe src="${src}" width="999" height="1" onload="x" srcdoc="<script>"></iframe></div>`
			)
		).toBe(embed('dQw4w9WgXcQ'));
	});

	it.each([
		'https://player.vimeo.com/video/1',
		'https://www.youtube.com.evil.example/embed/dQw4w9WgXcQ',
		'http://www.youtube.com/embed/dQw4w9WgXcQ',
		'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
		'https://www.youtube.com/embed/videoseries?list=x"onload="alert(1)',
		'javascript:alert(1)',
		'data:text/html,<script>alert(1)</script>'
	])('removes an iframe with %s', (src) => {
		expect(clean(`<p>a</p><div data-youtube-video=""><iframe src="${src}"></iframe></div>`)).toBe(
			'<p>a</p>'
		);
	});
});
