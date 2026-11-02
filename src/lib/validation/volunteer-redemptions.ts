import { z } from 'zod';

/* Admin form: reverse a perk mark (docs/05 section 28, docs/03 section 19.4 p. 5). */

const comment = z
	.string({ error: 'auth.error.required' })
	.trim()
	.min(1, { error: 'auth.error.required' })
	.max(1000, { error: 'auth.error.tooLong' });

export const reversePerkSchema = z.object({
	redemptionId: z.uuid(),
	comment
});
