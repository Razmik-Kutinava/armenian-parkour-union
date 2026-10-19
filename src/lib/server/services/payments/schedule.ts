/** Calls made while a run is in progress share it, so runs never overlap in one process. */
export function singleFlight<T>(run: () => Promise<T>): () => Promise<T> {
	let current: Promise<T> | null = null;
	return () => {
		current ??= run().finally(() => {
			current = null;
		});
		return current;
	};
}

type TimerOptions = { firstDelayMs: number; intervalMs: number };

/** Runs while the process lives; does not keep it alive. Returns `stop`. */
export function startTimer(
	run: () => Promise<unknown>,
	{ firstDelayMs, intervalMs }: TimerOptions
): () => void {
	const tick = () => {
		run().catch((e) => console.error('scheduled run failed', e));
	};
	let interval: ReturnType<typeof setInterval> | undefined;
	const first = setTimeout(() => {
		tick();
		interval = setInterval(tick, intervalMs);
		interval.unref?.();
	}, firstDelayMs);
	first.unref?.();
	return () => {
		clearTimeout(first);
		clearInterval(interval);
	};
}
