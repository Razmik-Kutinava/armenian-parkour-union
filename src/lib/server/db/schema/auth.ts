import {
	bigint,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	unique,
	uuid
} from 'drizzle-orm/pg-core';
import { users } from './users';

/* Better Auth 1.7 core tables (@better-auth/core/db/get-tables). Do not change by hand. */

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
	timestamp('updated_at', { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date());
const userId = () =>
	uuid('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' });

export const session = pgTable(
	'session',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		token: text('token').notNull().unique(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		userId: userId(),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [index('session_user_id_idx').on(t.userId)]
);

export const account = pgTable(
	'account',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		accountId: text('account_id').notNull(),
		providerId: text('provider_id').notNull(),
		userId: userId(),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
		refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
		scope: text('scope'),
		password: text('password'),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		index('account_user_id_idx').on(t.userId),
		unique('account_provider_account_unique').on(t.providerId, t.accountId)
	]
);

export const verification = pgTable(
	'verification',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		identifier: text('identifier').notNull(),
		value: text('value').notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [index('verification_identifier_idx').on(t.identifier)]
);

/** Login attempt counters for Better Auth rateLimit (storage: 'database'). */
export const rateLimit = pgTable('rate_limit', {
	id: uuid('id').primaryKey().defaultRandom(),
	key: text('key').notNull().unique(),
	count: integer('count').notNull(),
	lastRequest: bigint('last_request', { mode: 'number' }).notNull()
});
