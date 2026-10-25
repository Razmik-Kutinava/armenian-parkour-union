import type { Page } from '@playwright/test';

/* docs/08 section 12 (WCAG 2.2 AA) on the rendered page: what axe-style tools report, without a
 * new dependency. Each check returns readable findings; an empty list means the page passes. */

/** Text below 4.5 : 1 (3 : 1 for large text) against its nearest opaque background. */
export function lowContrast(page: Page): Promise<string[]> {
	return page.evaluate(() => {
		type Rgba = [number, number, number, number];
		const parse = (c: string): Rgba | null => {
			const m = /^rgba?\(([^)]+)\)$/.exec(c);
			if (!m) return null;
			const [r, g, b, a = 1] = m[1]
				.split(/[\s,/]+/)
				.filter(Boolean)
				.map(Number);
			return [r, g, b, a];
		};
		const channel = (v: number) => {
			const s = v / 255;
			return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
		};
		const lum = ([r, g, b]: Rgba) =>
			0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
		/* null — an image, a gradient or a translucent layer: not decidable here, skipped. */
		const background = (el: Element): Rgba | null => {
			for (let e: Element | null = el; e; e = e.parentElement) {
				const s = getComputedStyle(e);
				if (s.backgroundImage !== 'none' || Number(s.opacity) < 1) return null;
				const c = parse(s.backgroundColor);
				if (c && c[3] >= 1) return c;
				if (c && c[3] > 0) return null;
			}
			return [255, 255, 255, 1];
		};
		const found: string[] = [];
		for (const el of document.body.querySelectorAll('*')) {
			const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim());
			if (!own || el.closest('[aria-hidden="true"], :disabled, [aria-disabled="true"]')) continue;
			const box = el.getBoundingClientRect();
			if (box.width <= 1 || box.height <= 1) continue;
			if (!el.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue;
			const s = getComputedStyle(el);
			const fg = parse(s.color);
			const bg = background(el);
			if (!fg || !bg) continue;
			const mixed: Rgba = [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3])) as Rgba;
			const [hi, lo] = [lum(mixed), lum(bg)].sort((a, b) => b - a);
			const ratio = (hi + 0.05) / (lo + 0.05);
			const px = parseFloat(s.fontSize);
			const large = px >= 24 || (px >= 18.66 && Number(s.fontWeight) >= 700);
			if (ratio < (large ? 3 : 4.5))
				found.push(
					`${ratio.toFixed(2)} "${el.textContent!.trim().slice(0, 40)}" (${el.className})`
				);
		}
		return found;
	});
}

/** One main; navigation landmarks with distinct names; headings never skip a level going down;
 * no visible text outside the landmarks (the skip link aside). */
export function structureIssues(page: Page): Promise<string[]> {
	return page.evaluate(() => {
		const visible = (el: Element) => el.checkVisibility({ visibilityProperty: true });
		const found: string[] = [];
		const mains = [...document.querySelectorAll('main, [role="main"]')].filter(visible);
		if (mains.length !== 1) found.push(`main landmarks: ${mains.length}`);
		const navNames = [...document.querySelectorAll('nav, [role="navigation"]')]
			.filter(visible)
			.map((n) => n.getAttribute('aria-label') ?? '');
		for (const name of new Set(navNames))
			if (navNames.filter((n) => n === name).length > 1) found.push(`duplicate nav "${name}"`);
		let prev = 0;
		for (const h of [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')].filter(visible)) {
			const level = Number(h.tagName[1]);
			if (prev && level > prev + 1) found.push(`h${prev} → h${level} "${h.textContent!.trim()}"`);
			prev = level;
		}
		const landmark =
			'header, footer, main, nav, aside, section[aria-label], dialog, a[href="#content"]';
		for (const el of document.body.querySelectorAll('*')) {
			const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim());
			if (own && !el.closest(landmark) && visible(el) && el.tagName !== 'SCRIPT')
				found.push(`outside landmarks: "${el.textContent!.trim().slice(0, 40)}"`);
		}
		return found;
	});
}
