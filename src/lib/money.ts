/* main.mdc arch. 3: integers in minimal units + currency. AMD has no minor unit in use: whole drams. */

export const CURRENCIES = ['AMD', 'USD', 'EUR'] as const;
export type Currency = (typeof CURRENCIES)[number];

const DECIMALS: Record<Currency, number> = { AMD: 0, USD: 2, EUR: 2 };
/* Keeps the amount inside a Postgres integer. */
const WHOLE = /^\d{1,9}$/;
const CENTS = /^(\d{1,7})(?:\.(\d{1,2}))?$/;

/** Form text → minimal units; `null` when the text is not a price in that currency. */
export function priceToMinor(raw: string, currency: Currency): number | null {
	const text = raw.trim();
	if (DECIMALS[currency] === 0) return WHOLE.test(text) ? Number(text) : null;
	const match = CENTS.exec(text);
	if (!match) return null;
	return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
}

export function minorToInput(amountMinor: number, currency: Currency): string {
	if (DECIMALS[currency] === 0 || amountMinor % 100 === 0) {
		return String(DECIMALS[currency] === 0 ? amountMinor : amountMinor / 100);
	}
	return `${Math.floor(amountMinor / 100)}.${String(amountMinor % 100).padStart(2, '0')}`;
}

export function formatPrice(amountMinor: number, currency: string, locale: string): string {
	const decimals = DECIMALS[currency as Currency] ?? 2;
	return new Intl.NumberFormat(locale, {
		style: 'currency',
		currency,
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals
	}).format(amountMinor / 10 ** decimals);
}
