import type { z } from 'zod';
import type { MessageKey } from '#lib/i18n/translate.ts';

export type FieldErrors = Partial<Record<string, MessageKey>>;

/** First error per field; schema messages are i18n keys. */
export function fieldErrors(error: z.ZodError): FieldErrors {
	const errors: FieldErrors = {};
	for (const issue of error.issues) {
		const field = String(issue.path[0] ?? 'form');
		errors[field] ??= issue.message as MessageKey;
	}
	return errors;
}

/** Text fields to send back after a failed submit; passwords are never echoed. */
export function keepValues(form: FormData, fields: readonly string[]): Record<string, string> {
	return Object.fromEntries(fields.map((f) => [f, String(form.get(f) ?? '')]));
}
