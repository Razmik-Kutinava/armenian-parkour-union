import { describe, expect, it } from 'vitest';
import { normalizePracticeUrl } from './practice-link';

/* docs/03 section 18.4 p. 2: YouTube (unlisted too) or Google Drive, normalized; decisions —
 * docs/todo.md 9.7 (2). */

const ID = 'dQw4w9WgXcQ';
const DRIVE = '1AbC-dEf_GhIjKlMnOpQrStUvWxYz0123';
const youtube = { platform: 'youtube', url: `https://www.youtube.com/watch?v=${ID}` };
const drive = { platform: 'google_drive', url: `https://drive.google.com/file/d/${DRIVE}/view` };

describe('practice video link', () => {
	it('YouTube links of one video give one stored form', () => {
		for (const raw of [
			`https://www.youtube.com/watch?v=${ID}&t=42s`,
			`https://youtu.be/${ID}?si=share`,
			`https://m.youtube.com/watch?v=${ID}`,
			`https://www.youtube.com/shorts/${ID}`,
			`  https://youtube.com/embed/${ID}  `
		]) {
			expect(normalizePracticeUrl(raw), raw).toEqual(youtube);
		}
	});

	it('Google Drive file links give the view address', () => {
		for (const raw of [
			`https://drive.google.com/file/d/${DRIVE}/view?usp=sharing`,
			`https://drive.google.com/file/d/${DRIVE}/preview`,
			`https://drive.google.com/file/d/${DRIVE}`,
			`https://drive.google.com/open?id=${DRIVE}`,
			`https://drive.google.com/uc?id=${DRIVE}&export=download`
		]) {
			expect(normalizePracticeUrl(raw), raw).toEqual(drive);
		}
	});

	it('anything else is refused: folders, other hosts, http, Instagram, not a link', () => {
		for (const raw of [
			`https://drive.google.com/drive/folders/${DRIVE}`,
			`http://drive.google.com/file/d/${DRIVE}/view`,
			`https://drive.google.com.evil.test/file/d/${DRIVE}/view`,
			'https://drive.google.com/file/d/x/view',
			`http://www.youtube.com/watch?v=${ID}`,
			'https://www.youtube.com/watch?v=short',
			'https://www.instagram.com/reel/Cabc123/',
			'https://vimeo.com/123456',
			'video.mp4',
			''
		]) {
			expect(normalizePracticeUrl(raw), raw).toBeNull();
		}
	});
});
