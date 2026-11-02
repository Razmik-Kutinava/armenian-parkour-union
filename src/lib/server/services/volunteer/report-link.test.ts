import { describe, expect, it } from 'vitest';
import { normalizeReportUrl } from './report-link';

/* docs/03 section 19.7 p. 2; decisions — docs/todo.md 10.10 (1). */

describe('volunteer report: link', () => {
	it('normalizes Instagram, YouTube and Google Drive to one https form', () => {
		expect(normalizeReportUrl('https://instagram.com/reel/Cx1_ab-9?igsh=1')).toBe(
			'https://www.instagram.com/reel/Cx1_ab-9/'
		);
		expect(normalizeReportUrl('https://youtu.be/ppppppppppA')).toBe(
			'https://www.youtube.com/watch?v=ppppppppppA'
		);
		expect(normalizeReportUrl('https://drive.google.com/open?id=1AbCdEfGhIjKlMnOp')).toBe(
			'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view'
		);
	});

	it('rejects other hosts, http and folders', () => {
		for (const raw of [
			'https://vimeo.com/1',
			'http://www.youtube.com/watch?v=ppppppppppA',
			'https://drive.google.com/drive/folders/1AbCdEfGhIj',
			'https://www.instagram.com/someone/',
			'not a url'
		]) {
			expect(normalizeReportUrl(raw), raw).toBeNull();
		}
	});
});
