import { describe, expect, it } from 'vitest';
import { RICH_TEXT_MAX, richTextSchema } from './schema';

const schema = richTextSchema('https://media.parkour.am');

describe('richTextSchema', () => {
	it('cleans the HTML on parse', () => {
		expect(schema.parse('<p onclick="x">a</p><script>alert(1)</script>')).toBe('<p>a</p>');
	});

	it.each(['', '   ', '<p></p>', '<p> <br /> </p><h2></h2>', '<script>x</script>'])(
		'an empty editor %s becomes an empty string',
		(html) => {
			expect(schema.parse(html)).toBe('');
		}
	);

	it('keeps a text-less body with a video', () => {
		const video =
			'<div data-youtube-video=""><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe></div>';
		expect(schema.parse(video)).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ');
	});

	it('rejects an oversized body before cleaning', () => {
		const result = schema.safeParse(`<p>${'a'.repeat(RICH_TEXT_MAX)}</p>`);
		expect(result.success).toBe(false);
		expect(result.error?.issues[0].message).toBe('auth.error.tooLong');
	});

	it('rejects a non-string', () => {
		expect(schema.safeParse(42).success).toBe(false);
	});
});
