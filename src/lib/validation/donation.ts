import { z } from 'zod';
import { email, name, optional } from './auth';

/* docs/06 section 4.8. The range of the amount needs the settings: the service checks it. */
const amount = z
	.string({ error: 'donate.error.amount' })
	.transform((v) => v.replace(/\s/g, ''))
	.pipe(z.string().regex(/^\d{1,20}$/, { error: 'donate.error.amount' }));

const base = {
	amount,
	purposeId: optional(z.uuid({ error: 'donate.error.purpose' })),
	isAnonymous: z.preprocess((v) => v === 'on', z.boolean())
};

export type DonationForm = {
	amount: string;
	purposeId?: string;
	isAnonymous: boolean;
	donorName?: string;
	donorEmail?: string;
};

/** A guest gives name and email; a member's come from the account, so the form cannot set them. */
export function donationSchema(guest: boolean): z.ZodType<DonationForm> {
	return guest ? z.object({ ...base, donorName: name, donorEmail: email }) : z.object(base);
}
