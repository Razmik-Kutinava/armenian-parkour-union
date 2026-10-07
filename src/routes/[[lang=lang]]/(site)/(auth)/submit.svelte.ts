import type { SubmitFunction } from '$app/forms';

/** Progressive form submit: button shows loading, entered values stay after an error. */
export function createSubmit() {
	let submitting = $state(false);
	const submit: SubmitFunction = () => {
		submitting = true;
		return async ({ update }) => {
			await update({ reset: false });
			submitting = false;
		};
	};
	return {
		submit,
		get submitting() {
			return submitting;
		}
	};
}
