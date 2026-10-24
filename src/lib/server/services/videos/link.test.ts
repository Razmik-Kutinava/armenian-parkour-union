import { describe, expect, it } from 'vitest';
import { normalizeVideoUrl } from './link';

/* docs/03 section 8 p. 1–2: only allowed platforms; one video under different links is one link. */

const BOTH = ['youtube', 'instagram'] as const;
const WATCH = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

describe('normalizeVideoUrl', () => {
	it.each([
		'https://youtu.be/dQw4w9WgXcQ',
		'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s',
		'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
		'https://youtube.com/shorts/dQw4w9WgXcQ',
		'  https://www.youtube.com/embed/dQw4w9WgXcQ  '
	])('YouTube %s → one watch link', (raw) => {
		expect(normalizeVideoUrl(raw, BOTH)).toEqual({ platform: 'youtube', url: WATCH });
	});

	it('Instagram post and reel keep their kind', () => {
		expect(normalizeVideoUrl('https://instagram.com/reel/Cx1_ab-9?igsh=1', BOTH)).toEqual({
			platform: 'instagram',
			url: 'https://www.instagram.com/reel/Cx1_ab-9/'
		});
		expect(normalizeVideoUrl('https://www.instagram.com/p/Cx1/', BOTH)).toEqual({
			platform: 'instagram',
			url: 'https://www.instagram.com/p/Cx1/'
		});
	});

	it.each([
		'https://vimeo.com/1',
		'https://www.tiktok.com/@a/video/1',
		'http://youtu.be/dQw4w9WgXcQ',
		'https://www.youtube.com/channel/abc',
		'not a link',
		''
	])('refuses %s', (raw) => {
		expect(normalizeVideoUrl(raw, BOTH)).toBeNull();
	});

	it('a platform switched off in the settings is refused', () => {
		expect(normalizeVideoUrl(WATCH, ['instagram'])).toBeNull();
		expect(normalizeVideoUrl('https://www.instagram.com/p/Cx1/', ['youtube'])).toBeNull();
	});
});
