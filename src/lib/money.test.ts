import { describe, expect, it } from 'vitest';
import { CURRENCIES, formatPrice, minorToInput, priceToMinor } from './money';

/* main.mdc arch. 3; docs/02 conventions: integers in minimal units + currency. AMD — whole drams. */
describe('money: price in minimal units', () => {
	it('currencies are AMD, USD, EUR', () => {
		expect(CURRENCIES).toEqual(['AMD', 'USD', 'EUR']);
	});

	it('AMD is entered in whole drams', () => {
		expect(priceToMinor('5000', 'AMD')).toBe(5000);
		expect(priceToMinor(' 0 ', 'AMD')).toBe(0);
		for (const bad of ['5000.5', '-1', '1e3', '', 'abc', '1 000', '1234567890']) {
			expect(priceToMinor(bad, 'AMD'), bad).toBeNull();
		}
	});

	it('USD and EUR take up to 2 decimals and are stored in cents, without float errors', () => {
		expect(priceToMinor('10', 'USD')).toBe(1000);
		expect(priceToMinor('10.5', 'EUR')).toBe(1050);
		expect(priceToMinor('0.29', 'USD')).toBe(29);
		expect(priceToMinor('19.99', 'USD')).toBe(1999);
		for (const bad of ['1.234', '.5', '1.', '-2', '12345678']) {
			expect(priceToMinor(bad, 'USD'), bad).toBeNull();
		}
	});

	it('the stored amount goes back to the form field', () => {
		expect(minorToInput(5000, 'AMD')).toBe('5000');
		expect(minorToInput(1050, 'EUR')).toBe('10.50');
		expect(minorToInput(1000, 'USD')).toBe('10');
		expect(minorToInput(0, 'USD')).toBe('0');
	});

	it('the price is shown with its currency', () => {
		expect(formatPrice(5000, 'AMD', 'en')).toMatch(/5,000/);
		expect(formatPrice(5000, 'AMD', 'en')).toMatch(/AMD|֏/);
		expect(formatPrice(1050, 'USD', 'en')).toBe('$10.50');
	});
});
