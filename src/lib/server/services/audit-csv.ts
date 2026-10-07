/* CSV for the audit log export (docs/05 section 22). RFC 4180 quoting, CRLF line ends. */

/** Cells starting like a formula are prefixed with ' so a spreadsheet shows them as text. */
const FORMULA = /^[=+\-@\t\r]/;

function cell(value: unknown): string {
	if (value === null || value === undefined) return '';
	let text =
		value instanceof Date
			? value.toISOString()
			: typeof value === 'object'
				? JSON.stringify(value)
				: String(value);
	if (FORMULA.test(text)) text = `'${text}`;
	return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: unknown[][]): string {
	return [header, ...rows].map((r) => r.map(cell).join(',') + '\r\n').join('');
}
