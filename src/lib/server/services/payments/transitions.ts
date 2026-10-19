import type { ProviderStatus } from './providers/types';

export type PaymentStatus = ProviderStatus;

/* docs/07 section 10: every transition not listed here is forbidden; refunded is final. */
const allowed: Record<PaymentStatus, readonly PaymentStatus[]> = {
	pending: ['paid', 'failed', 'cancelled'],
	paid: ['refunded'],
	failed: ['paid'],
	cancelled: ['paid'],
	refunded: []
};

export function canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
	return allowed[from].includes(to);
}
