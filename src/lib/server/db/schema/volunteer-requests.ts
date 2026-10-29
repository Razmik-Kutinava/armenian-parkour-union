import { sql } from 'drizzle-orm';
import {
	check,
	index,
	jsonb,
	pgTable,
	smallint,
	text,
	timestamp,
	unique,
	uniqueIndex,
	uuid
} from 'drizzle-orm/pg-core';
import { practiceStatus, volunteerAnswer, volunteerRequestStatus } from './enums';
import { events } from './events';
import { users } from './users';

/* docs/02-DATABASE.md section 12 (volunteer requests, invitations, reports). */

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
	timestamp('updated_at', { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date());

/** No deletion: a draft is cancelled. */
export const volunteerRequests = pgTable(
	'volunteer_requests',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		title: jsonb('title').notNull(),
		/** What to do, where and when to gather (sanitized HTML). */
		description: jsonb('description'),
		eventId: uuid('event_id').references(() => events.id),
		startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
		endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
		location: text('location'),
		places: smallint('places').notNull(),
		respondBy: timestamp('respond_by', { withTimezone: true }).notNull(),
		status: volunteerRequestStatus('status').notNull().default('draft'),
		/** When the invitations were sent. */
		publishedAt: timestamp('published_at', { withTimezone: true }),
		/** Answers summed up after `respond_by` (docs/03 section 19.5). */
		closedAt: timestamp('closed_at', { withTimezone: true }),
		createdBy: uuid('created_by').references(() => users.id),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		index('volunteer_requests_status_respond_by_idx').on(t.status, t.respondBy),
		index('volunteer_requests_event_id_idx').on(t.eventId),
		check('volunteer_requests_times', sql`${t.endsAt} >= ${t.startsAt}`),
		check('volunteer_requests_respond_by', sql`${t.respondBy} <= ${t.startsAt}`),
		check('volunteer_requests_places', sql`${t.places} >= 1`)
	]
);

/** Created when the request is sent out. */
export const volunteerInvitations = pgTable(
	'volunteer_invitations',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		requestId: uuid('request_id')
			.notNull()
			.references(() => volunteerRequests.id),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id),
		status: volunteerAnswer('status').notNull().default('invited'),
		answeredAt: timestamp('answered_at', { withTimezone: true }),
		/** Who marked attendance or excused. */
		markedBy: uuid('marked_by').references(() => users.id),
		markedAt: timestamp('marked_at', { withTimezone: true }),
		/** Counted in the declines in a row, once per invitation. */
		countedAt: timestamp('counted_at', { withTimezone: true }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		unique('volunteer_invitations_request_id_user_id_key').on(t.requestId, t.userId),
		index('volunteer_invitations_user_id_created_at_idx').on(t.userId, t.createdAt.desc()),
		index('volunteer_invitations_request_id_status_idx').on(t.requestId, t.status)
	]
);

/** A photo (private bucket, `volunteer/<user id>/<uuid>.<ext>`) or a normalized link;
 * a resubmission after a refusal is a new row. */
export const volunteerReports = pgTable(
	'volunteer_reports',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		invitationId: uuid('invitation_id')
			.notNull()
			.references(() => volunteerInvitations.id),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id),
		fileKey: text('file_key'),
		url: text('url'),
		note: text('note'),
		status: practiceStatus('status').notNull().default('pending'),
		reviewedBy: uuid('reviewed_by').references(() => users.id),
		reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
		/** Shown to the member; required for `rejected`. */
		reviewNote: text('review_note'),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		uniqueIndex('volunteer_reports_live_key')
			.on(t.invitationId)
			.where(sql`${t.status} IN ('pending', 'approved')`),
		index('volunteer_reports_status_created_at_idx').on(t.status, t.createdAt),
		index('volunteer_reports_user_id_idx').on(t.userId),
		check('volunteer_reports_one_source', sql`num_nonnulls(${t.fileKey}, ${t.url}) = 1`),
		check(
			'volunteer_reports_review_note',
			sql`${t.status} <> 'rejected' OR btrim(coalesce(${t.reviewNote}, '')) <> ''`
		)
	]
);
