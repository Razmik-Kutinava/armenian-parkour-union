import { describe, expect, it } from 'vitest';
import { toCsv } from './audit-csv';

describe('toCsv', () => {
	it('quotes commas, quotes and line breaks; CRLF between rows', () => {
		const csv = toCsv(
			['a', 'b'],
			[
				['x,y', 'say "hi"'],
				['line\nbreak', null]
			]
		);
		expect(csv).toBe('a,b\r\n"x,y","say ""hi"""\r\n"line\nbreak",\r\n');
	});

	it('neutralises spreadsheet formulas', () => {
		const csv = toCsv(['v'], [['=HYPERLINK("x")'], ['+1'], ['-2'], ['@cmd'], ['\tx']]);
		const cells = csv.trim().split('\r\n').slice(1);
		for (const cell of cells) expect(cell.replace(/^"/, '').startsWith("'")).toBe(true);
	});

	it('dates as ISO, objects as JSON', () => {
		const csv = toCsv(['d', 'o'], [[new Date('2026-10-07T10:00:00Z'), { k: 1 }]]);
		expect(csv).toBe('d,o\r\n2026-10-07T10:00:00.000Z,"{""k"":1}"\r\n');
	});
});
