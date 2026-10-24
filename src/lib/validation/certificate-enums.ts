/* Certificate kinds and states (docs/02 `certificate_kind`, `certificate_status`). Client-safe:
 * pages take them from here. */

export const CERTIFICATE_KINDS = ['level', 'trainer', 'judge'] as const;
export type CertificateKindValue = (typeof CERTIFICATE_KINDS)[number];

export const CERTIFICATE_LEVELS = ['advanced', 'pro'] as const;

/** The list filter "type": a level certificate is split by its level, like its title. */
export const CERTIFICATE_TYPES = ['level_advanced', 'level_pro', 'trainer', 'judge'] as const;

/** `active` with a passed `expires_at` is shown as `expired` (docs/03 section 4.6). */
export const CERTIFICATE_STATES = ['active', 'expired', 'revoked'] as const;
export type CertificateStateValue = (typeof CERTIFICATE_STATES)[number];

/** docs/05 section 8: "expiring within 60 days". */
export const EXPIRING_DAYS = 60;

/** The same limits as the service (`CERTIFICATE_CATEGORY_MAX`, `CERTIFICATE_COMMENT_MAX`). */
export const CERTIFICATE_CATEGORY_MAX = 100;
export const CERTIFICATE_COMMENT_MAX = 2000;
export const REVOKE_REASON_MAX = 1000;
