import { describe, expect, it } from 'vitest';
import {
	MODERATION_BATCH,
	moderationFormSchema,
	videoFormSchema,
	videoSettingsFormSchema
} from './videos';

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

/* docs/05 section 11: selected videos (a quick button — one), the reason for a refusal. */
describe('moderationFormSchema', () => {
	const id = () => crypto.randomUUID();

	it('ids and a trimmed comment; the comment may be empty', () => {
		const ids = [id(), id()];
		expect(moderationFormSchema.parse({ ids, comment: ' Not parkour ' })).toEqual({
			ids,
			comment: 'Not parkour'
		});
		expect(moderationFormSchema.parse({ ids }).comment).toBe('');
	});

	it.each([
		[[], 'videos.admin.error.select'],
		[['nope'], 'videos.admin.error.select'],
		[
			Array.from({ length: MODERATION_BATCH + 1 }, () => crypto.randomUUID()),
			'videos.admin.error.tooMany'
		]
	])('ids %# → %s', (ids, message) => {
		const result = moderationFormSchema.safeParse({ ids });
		expect(result.success).toBe(false);
		expect(result.error?.issues[0].message).toBe(message);
	});

	it('a comment over 1000 characters is refused', () => {
		const result = moderationFormSchema.safeParse({ ids: [id()], comment: 'x'.repeat(1001) });
		expect(result.error?.issues[0].message).toBe('auth.error.tooLong');
	});
});

/* docs/05 section 21: the monthly limit 1–100 and at least one platform. */
describe('videoSettingsFormSchema', () => {
	it('a whole number and the chosen platforms', () => {
		expect(
			videoSettingsFormSchema.parse({ monthlyLimit: ' 7 ', platforms: ['instagram', 'youtube'] })
		).toEqual({ monthlyLimit: 7, platforms: ['instagram', 'youtube'] });
	});

	it.each([
		[{ monthlyLimit: '0', platforms: ['youtube'] }, 'monthlyLimit', 'videos.settings.error.limit'],
		[
			{ monthlyLimit: '101', platforms: ['youtube'] },
			'monthlyLimit',
			'videos.settings.error.limit'
		],
		[
			{ monthlyLimit: '2.5', platforms: ['youtube'] },
			'monthlyLimit',
			'videos.settings.error.limit'
		],
		[{ monthlyLimit: '', platforms: ['youtube'] }, 'monthlyLimit', 'videos.settings.error.limit'],
		[{ monthlyLimit: '5', platforms: [] }, 'platforms', 'videos.settings.error.platforms'],
		[{ monthlyLimit: '5', platforms: ['vimeo'] }, 'platforms', 'videos.settings.error.platforms']
	])('%j → %s: %s', (value, field, message) => {
		const result = videoSettingsFormSchema.safeParse(value);
		expect(result.success).toBe(false);
		const issue = result.error?.issues.find((i) => i.path[0] === field);
		expect(issue?.message).toBe(message);
	});
});
