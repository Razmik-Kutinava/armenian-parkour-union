export type ToastTone = 'success' | 'error' | 'info';

export interface Toast {
	id: number;
	tone: ToastTone;
	message: string;
}

/** Non-error toasts disappear after this delay; errors stay until closed (08-DESIGN, 8.1). */
export const TOAST_TIMEOUT_MS = 5000;

let nextId = 1;
const timers: Record<number, ReturnType<typeof setTimeout>> = {};

/** Module state is shared across SSR requests: call showToast only from browser code. */
export const toasts: Toast[] = $state([]);

export function dismissToast(id: number): void {
	clearTimeout(timers[id]);
	delete timers[id];
	const index = toasts.findIndex((t) => t.id === id);
	if (index !== -1) toasts.splice(index, 1);
}

export function showToast(tone: ToastTone, message: string): number {
	const id = nextId++;
	toasts.push({ id, tone, message });
	if (tone !== 'error') timers[id] = setTimeout(() => dismissToast(id), TOAST_TIMEOUT_MS);
	return id;
}
