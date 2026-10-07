/** Shared look of text-like form controls (08-DESIGN, 8.1): 44 px, line border, navy-600 focus. */
export const controlClass =
	'h-11 w-full rounded-sm border border-line bg-surface text-base text-ink-900 ' +
	'transition-colors duration-(--dur-fast) placeholder:text-ink-500 ' +
	'hover:border-ink-500 focus:border-navy-600 focus:outline-2 focus:outline-offset-0 focus:outline-navy-600 ' +
	'disabled:cursor-not-allowed disabled:bg-navy-50 disabled:text-ink-500 ' +
	'aria-invalid:border-error-fg aria-invalid:focus:outline-error-fg';
