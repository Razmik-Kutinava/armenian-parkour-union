/* Coach and judge profiles (docs/02 `staff_kind`, `staff_profiles`). Client-safe: pages take them
 * from here. */

export const STAFF_KINDS = ['trainer', 'judge'] as const;
export type StaffKindValue = (typeof STAFF_KINDS)[number];

/** List filters "active" and "public" (docs/05 section 9). */
export const STAFF_FLAGS = ['yes', 'no'] as const;

/** The category is copied from the certificate: the same limit as `CERTIFICATE_CATEGORY_MAX`. */
export const STAFF_CATEGORY_MAX = 100;
export const STAFF_LICENSE_MAX = 60;
export const STAFF_BIO_MAX = 2000;
