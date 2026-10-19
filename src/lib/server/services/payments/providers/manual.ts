import { CURRENCIES } from '#lib/money.ts';
import type { OfflineProvider } from './types';

/** Bank transfer or cash recorded by an admin; always available (docs/07 sections 1.8, 9). */
export const manualProvider: OfflineProvider = {
	id: 'manual',
	online: false,
	currencies: CURRENCIES
};
