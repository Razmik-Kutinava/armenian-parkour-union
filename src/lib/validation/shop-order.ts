import { z } from 'zod';
import { name, phone } from './auth';

/* docs/06 section 4.7: the delivery form of an order; limits — docs/todo.md 7.6 (10). Both sides:
 * no server imports. */

export const DELIVERY_LIMITS = { recipientName: 100, city: 100, address: 300, comment: 1000 };

const required = (max: number) =>
	z
		.string({ error: 'auth.error.required' })
		.trim()
		.min(1, { error: 'auth.error.required' })
		.max(max, { error: 'auth.error.tooLong' });

export const deliverySchema = z.object({
	recipientName: name,
	phone: z.string({ error: 'auth.error.phone' }).pipe(phone),
	city: required(DELIVERY_LIMITS.city),
	address: required(DELIVERY_LIMITS.address),
	comment: z
		.string()
		.trim()
		.max(DELIVERY_LIMITS.comment, { error: 'auth.error.tooLong' })
		.nullish()
		.transform((v) => v || null)
});
export type DeliveryValues = z.output<typeof deliverySchema>;

export const DELIVERY_FIELDS = ['recipientName', 'phone', 'city', 'address', 'comment'] as const;

/** Option fields are `option.{name}`, apart from the delivery fields; missing — empty. */
export const optionsFromForm = (form: FormData, names: string[]): Record<string, string> =>
	Object.fromEntries(names.map((n) => [n, String(form.get(`option.${n}`) ?? '')]));
