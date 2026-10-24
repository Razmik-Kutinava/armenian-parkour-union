import { describe, expect, it } from 'vitest';
import { videoFormSchema } from './videos';

/* docs/06 section 5.7: link, title, event (optional). */

describe('videoFormSchema', () => {
	it('trims; an empty event is none', () => {
		expect(
			videoFormSchema.parse({ url: ' https://youtu.be/x ', title: ' Run ', eventId: '' })
		).toEqual({ url: 'https://youtu.be/x', title: 'Run', eventId: null });
		expect(videoFormSchema.parse({ url: 'u', title: 't' }).eventId).toBeNull();
	});

	it.each([
		[{ url: ' ', title: 'Run' }, 'url', 'videos.error.url'],
		[{ url: 'u', title: '  ' }, 'title', 'videos.error.title'],
		[{ url: 'u'.repeat(501), title: 'Run' }, 'url', 'auth.error.tooLong'],
		[{ url: 'u', title: 't'.repeat(121) }, 'title', 'auth.error.tooLong']
	])('%j → %s: %s', (value, field, message) => {
		const result = videoFormSchema.safeParse(value);
		expect(result.success).toBe(false);
		const issue = result.error?.issues.find((i) => i.path[0] === field);
		expect(issue?.message).toBe(message);
	});
});
