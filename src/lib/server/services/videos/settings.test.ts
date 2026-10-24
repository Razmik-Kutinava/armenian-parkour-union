import { describe, expect, it } from 'vitest';
import { VIDEO_DEFAULTS, parseVideoSettings } from './settings';

/* docs/03 section 6.2 p. 7, 16: `site_settings.videos`; 5 a month, YouTube and Instagram by default. */

describe('parseVideoSettings', () => {
	it('defaults: 5 a month, YouTube and Instagram', () => {
		expect(VIDEO_DEFAULTS).toEqual({ monthlyLimit: 5, platforms: ['youtube', 'instagram'] });
	});

	it.each([undefined, null, 'x', [], {}])('missing or broken value %j → defaults', (value) => {
		expect(parseVideoSettings(value)).toEqual(VIDEO_DEFAULTS);
	});

	it('reads stored fields; a broken field falls back alone', () => {
		expect(parseVideoSettings({ monthly_limit: 2, platforms: ['instagram'] })).toEqual({
			monthlyLimit: 2,
			platforms: ['instagram']
		});
		expect(parseVideoSettings({ monthly_limit: 0, platforms: ['vimeo'] })).toEqual(VIDEO_DEFAULTS);
		expect(parseVideoSettings({ monthly_limit: 1.5, platforms: [] })).toEqual(VIDEO_DEFAULTS);
	});
});
