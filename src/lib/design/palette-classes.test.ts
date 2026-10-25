import { describe, expect, it } from 'vitest';

/* app.css resets Tailwind's palette (`--color-*: initial`, 08-DESIGN section 14): a default colour
 * class such as `text-white` produces no CSS, and the text silently takes the parent's colour —
 * dark text on a dark button. Only the design tokens exist as colour classes. */

const sources = import.meta.glob<string>(
	['/src/**/*.svelte', '/src/**/*.ts', '!/src/**/*.test.ts'],
	{
		query: '?raw',
		import: 'default',
		eager: true
	}
);

const PALETTE =
	'white|black|gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const PREFIX =
	'text|bg|border|outline|ring|fill|stroke|decoration|divide|placeholder|from|via|to|caret|shadow';
const DEFAULT_COLOUR = new RegExp(
	`(?<![\\w-])(?:${PREFIX})-(?:${PALETTE})(?:-\\d{2,3})?(?:/\\d+)?(?![\\w-])`,
	'g'
);

describe('colour classes come from the design tokens only', () => {
	const files = Object.entries(sources);

	it('the scan sees the components (sanity)', () => {
		expect(files.length).toBeGreaterThan(100);
		expect(sources['/src/lib/components/ui/Button.svelte']).toContain('text-surface');
	});

	it('no Tailwind default palette class (text-white, bg-gray-100…)', () => {
		const found = files.flatMap(([file, text]) =>
			[...text.matchAll(DEFAULT_COLOUR)].map((m) => `${file}: ${m[0]}`)
		);
		expect(found).toEqual([]);
	});
});
