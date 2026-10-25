import { pickLocalized } from '#lib/i18n/localized.ts';
import type { Locale } from '#lib/i18n/locales.ts';
import type { OrderLine } from '#lib/server/services/shop/order-list.ts';

/** `Size: M, Color: Black` — the options the member chose. */
export const optionsText = (options: Record<string, string> | null) =>
	Object.entries(options ?? {})
		.map(([name, value]) => `${name}: ${value}`)
		.join(', ');

/** `Cap × 2 (Size: M)` for the list. */
export function lineText(line: OrderLine, locale: Locale) {
	const options = optionsText(line.selectedOptions);
	const base = `${pickLocalized(line.title, locale)} × ${line.quantity}`;
	return options ? `${base} (${options})` : base;
}
