import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TOAST_TIMEOUT_MS, dismissToast, showToast, toasts } from './toast.svelte';

describe('toast queue', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => {
		[...toasts].forEach((t) => dismissToast(t.id));
		vi.useRealTimers();
	});

	it('adds toasts in order with unique ids', () => {
		const a = showToast('success', 'Saved');
		const b = showToast('info', 'Heads up');
		expect(a).not.toBe(b);
		expect(toasts.map((t) => t.message)).toEqual(['Saved', 'Heads up']);
	});

	it('auto-dismisses success and info after the timeout', () => {
		showToast('success', 'Saved');
		showToast('info', 'Heads up');
		vi.advanceTimersByTime(TOAST_TIMEOUT_MS - 1);
		expect(toasts).toHaveLength(2);
		vi.advanceTimersByTime(1);
		expect(toasts).toHaveLength(0);
	});

	it('keeps errors until dismissed', () => {
		const id = showToast('error', 'Payment failed');
		vi.advanceTimersByTime(TOAST_TIMEOUT_MS * 10);
		expect(toasts.map((t) => t.id)).toEqual([id]);
		dismissToast(id);
		expect(toasts).toHaveLength(0);
	});

	it('manual dismiss cancels the timer and ignores unknown ids', () => {
		const id = showToast('success', 'Saved');
		dismissToast(id);
		dismissToast(999);
		vi.advanceTimersByTime(TOAST_TIMEOUT_MS);
		expect(toasts).toHaveLength(0);
	});
});
