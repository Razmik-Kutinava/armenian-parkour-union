import { describe, expect, it } from 'vitest';
import { letterHtml } from './layout';

const SITE = 'https://parkour.am';
const mail = (text: string, subject = 'Subject') => ({ to: 'a@example.com', subject, text });

describe('letterHtml (task 8.2, one branded template)', () => {
	it('wraps the text in the brand header and a footer linking to the site', () => {
		const html = letterHtml(mail('Hello'), SITE);
		expect(html).toMatch(/^<!doctype html>/i);
		expect(html).toContain('Armenian Parkour Union');
		expect(html).toContain('#1F4E78');
		expect(html).toContain('<a href="https://parkour.am"');
		expect(html).toContain('Hello');
	});

	it('without a site address the footer has no link', () => {
		const html = letterHtml(mail('Hello'), undefined);
		expect(html).toContain('Armenian Parkour Union');
		expect(html).not.toContain('<a ');
	});

	it('escapes markup in the text and the subject', () => {
		const html = letterHtml(mail('<script>x</script> & "q"', '<b>Hi</b>'), SITE);
		expect(html).not.toContain('<script>');
		expect(html).not.toContain('<b>Hi</b>');
		expect(html).toContain('&lt;script&gt;x&lt;/script&gt; &amp; &quot;q&quot;');
		expect(html).toContain('&lt;b&gt;Hi&lt;/b&gt;');
	});

	it('blank lines make paragraphs, single line breaks stay', () => {
		const html = letterHtml(mail('One\nline two\n\nSecond'), SITE);
		expect(html).toMatch(/<p[^>]*>One<br>line two<\/p>/);
		expect(html).toMatch(/<p[^>]*>Second<\/p>/);
	});

	it('addresses become links; a trailing dot or bracket is not part of the address', () => {
		const html = letterHtml(
			mail('Open https://x.am/verify?token=a1&b=2. (see https://x.am/p)'),
			SITE
		);
		expect(html).toContain('<a href="https://x.am/verify?token=a1&amp;b=2"');
		expect(html).toContain('>https://x.am/verify?token=a1&amp;b=2</a>.');
		expect(html).toContain('<a href="https://x.am/p"');
		expect(html).toContain('</a>)');
	});

	it('Armenian and Russian text is kept as is', () => {
		const html = letterHtml(mail('Բարև, Анна'), SITE);
		expect(html).toContain('Բարև, Анна');
		expect(html).toContain('<meta charset="utf-8">');
	});
});
