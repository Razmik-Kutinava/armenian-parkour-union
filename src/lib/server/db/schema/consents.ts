import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { consentKind, consentStatus } from './enums';
import { users } from './users';

/* docs/02-DATABASE.md section 9; `review_note`, `updated_at` — decisions.md 2026-10-22 (5.1). */

/** The file is personal data: served only by a short-lived signed link, never a public URL. */
export const consents = pgTable(
	'consents',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id),
		kind: consentKind('kind').notNull(),
		status: consentStatus('status').notNull().default('pending'),
		guardianName: text('guardian_name'),
		fileKey: text('file_key'),
		signedAt: timestamp('signed_at', { withTimezone: true }),
		validUntil: timestamp('valid_until', { withTimezone: true }),
		reviewedBy: uuid('reviewed_by').references(() => users.id),
		/** Shown to the member when the consent is rejected. */
		reviewNote: text('review_note'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date())
	},
	(t) => [
		index('consents_user_id_idx').on(t.userId),
		index('consents_kind_status_idx').on(t.kind, t.status)
	]
);
