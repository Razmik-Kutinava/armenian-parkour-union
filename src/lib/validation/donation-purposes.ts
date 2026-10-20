import { z } from 'zod';
import { localizedText } from './site-settings';

/* Admin form "Donation purposes" (docs/05 section 17). Hidden with "active" off, never deleted. */

export const purposeFormSchema = z.object({
	title: localizedText(200),
	isActive: z.preprocess((v) => v === 'on', z.boolean()),
	sortOrder: z
		.string()
		.trim()
		.regex(/^\d{1,4}$/, { error: 'purposes.error.order' })
		.transform(Number)
		.default(0)
});

export type PurposeValues = z.output<typeof purposeFormSchema>;
