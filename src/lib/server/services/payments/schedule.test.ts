import { afterEach, describe, expect, it, vi } from 'vitest';
import { singleFlight, startTimer } from './schedule';

/* docs/07 section 7 p. 2: every 5 minutes while the machine is up; the timer and the hourly
 * external call never run two reconciliations at once in one process. */

describe('payments: reconciliation schedule', () => {
	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('calls during a run share it; the next call after it starts a new one', async () => {
		let release!: (n: number) => void;
		const run = vi.fn(() => new Promise<number>((resolve) => (release = resolve)));
		const once = singleFlight(run);
		const a = once();
		const b = once();
		release(1);
		expect(await Promise.all([a, b])).toEqual([1, 1]);
		expect(run).toHaveBeenCalledTimes(1);
		const c = once();
		release(2);
		expect(await c).toBe(2);
		expect(run).toHaveBeenCalledTimes(2);
	});

	it('a failed run frees the slot', async () => {
		const run = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce('ok');
		const once = singleFlight(run);
		await expect(once()).rejects.toThrow('down');
		expect(await once()).toBe('ok');
	});

	it('timer: first run after the delay, then every interval; errors are logged, not thrown', async () => {
		vi.useFakeTimers();
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const run = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValue(undefined);
		const stop = startTimer(run, { firstDelayMs: 30_000, intervalMs: 300_000 });
		await vi.advanceTimersByTimeAsync(29_999);
		expect(run).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(run).toHaveBeenCalledTimes(1);
		expect(console.error).toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(600_000);
		expect(run).toHaveBeenCalledTimes(3);
		stop();
		await vi.advanceTimersByTimeAsync(600_000);
		expect(run).toHaveBeenCalledTimes(3);
	});
});
