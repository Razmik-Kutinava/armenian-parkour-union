import { describe, expect, it } from 'vitest';
import { parseVideoUrl, youtubeEmbedUrl, youtubeThumbUrl } from './youtube';

/* decisions.md 2026-10-08 (2.6): YouTube — picture and player on click; Instagram — a link. */

describe('hero video link', () => {
	it('reads the YouTube id from watch, short, shorts and embed links', () => {
		for (const url of [
			'https://www.youtube.com/watch?v=kMpYHcuipuY',
			'https://youtube.com/watch?v=kMpYHcuipuY&t=42s',
			'https://m.youtube.com/watch?feature=share&v=kMpYHcuipuY',
			'https://youtu.be/kMpYHcuipuY',
			'https://youtu.be/kMpYHcuipuY?si=abc',
			'https://www.youtube.com/shorts/kMpYHcuipuY',
			'https://www.youtube.com/embed/kMpYHcuipuY',
			'https://www.youtube-nocookie.com/embed/kMpYHcuipuY'
		]) {
			expect(parseVideoUrl(url), url).toEqual({ kind: 'youtube', id: 'kMpYHcuipuY' });
		}
	});

	it('keeps an Instagram post or reel as a link without tracking', () => {
		expect(parseVideoUrl('https://www.instagram.com/reel/C8abc_12-x/?igsh=xyz')).toEqual({
			kind: 'instagram',
			url: 'https://www.instagram.com/reel/C8abc_12-x/'
		});
		expect(parseVideoUrl('https://instagram.com/p/C8abc12x')).toEqual({
			kind: 'instagram',
			url: 'https://www.instagram.com/p/C8abc12x/'
		});
	});

	it('refuses other sites, plain http, bad ids and other YouTube pages', () => {
		for (const url of [
			'',
			'not a url',
			'http://www.youtube.com/watch?v=kMpYHcuipuY',
			'https://vimeo.com/123456',
			'https://www.youtube.com/watch?v=short',
			'https://www.youtube.com/watch?v=kMpYHcuipuY"onload',
			'https://www.youtube.com/channel/UC123',
			'https://www.youtube.com.evil.example/watch?v=kMpYHcuipuY',
			'https://www.instagram.com/someone/',
			'javascript:alert(1)'
		]) {
			expect(parseVideoUrl(url), url).toBeNull();
		}
	});

	it('builds the picture and the privacy-friendly player address from the id', () => {
		expect(youtubeThumbUrl('kMpYHcuipuY')).toBe('https://i.ytimg.com/vi/kMpYHcuipuY/hqdefault.jpg');
		expect(youtubeEmbedUrl('kMpYHcuipuY')).toBe(
			'https://www.youtube-nocookie.com/embed/kMpYHcuipuY?autoplay=1&rel=0'
		);
	});
});
