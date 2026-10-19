const STEPS = [1, 5, 10, 20];

/** docs/06 section 4.8: quick amounts from the limits in the settings, within the maximum. */
export function amountPresets(minMinor: number, maxMinor: number): number[] {
	const amounts = STEPS.map((step) => minMinor * step).filter((amount) => amount <= maxMinor);
	return [...new Set(amounts)];
}
