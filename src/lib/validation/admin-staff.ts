import { z } from 'zod';
import { STAFF_BIO_MAX, STAFF_CATEGORY_MAX, STAFF_LICENSE_MAX } from './staff-enums';

/* Admin form "Coaches and judges" (docs/05 section 9). The member and the kind come from the
 * certificate and are not in the form; the service checks "active" against a live certificate. */

const text = (max: number) =>
	z
		.string()
		.trim()
		.max(max, { error: 'auth.error.tooLong' })
		.optional()
		.transform((v) => v || null);

/** An unchecked box sends nothing. */
const box = z.preprocess((v) => v === 'on', z.boolean());

export const staffProfileSchema = z
	.object({
		category: text(STAFF_CATEGORY_MAX),
		licenseNumber: text(STAFF_LICENSE_MAX),
		bioEn: text(STAFF_BIO_MAX),
		bioHy: text(STAFF_BIO_MAX),
		bioRu: text(STAFF_BIO_MAX),
		isPublic: box,
		isActive: box
	})
	.transform((f, ctx) => {
		/* docs/05 section 1 item 4: English is required, the others fall back to it. */
		if (!f.bioEn && (f.bioHy || f.bioRu)) {
			ctx.addIssue({ code: 'custom', path: ['bioEn'], message: 'staff.error.bioEn' });
		}
		return {
			category: f.category,
			licenseNumber: f.licenseNumber,
			bio: f.bioEn
				? { en: f.bioEn, ...(f.bioHy && { hy: f.bioHy }), ...(f.bioRu && { ru: f.bioRu }) }
				: null,
			isPublic: f.isPublic,
			isActive: f.isActive
		};
	});

export type StaffProfileValues = z.output<typeof staffProfileSchema>;
