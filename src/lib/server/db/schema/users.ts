import { sql } from 'drizzle-orm';
import {
	boolean,
	char,
	check,
	date,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core';
import { membershipLevel, userRole, userStatus } from './enums';

/** docs/02-DATABASE.md, section 1. Also the Better Auth user model (`image` maps to avatarKey). */
export const users = pgTable(
	'users',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		email: text('email').notNull().unique(),
		emailVerified: boolean('email_verified').notNull().default(false),
		name: text('name').notNull(),
		firstName: text('first_name'),
		lastName: text('last_name'),
		birthDate: date('birth_date'),
		phone: text('phone'),
		country: char('country', { length: 2 }).default('AM'),
		city: text('city'),
		avatarKey: text('avatar_key'),
		bio: text('bio'),
		locale: text('locale').notNull().default('ru'),
		role: userRole('role').notNull().default('member'),
		status: userStatus('status').notNull().default('active'),
		level: membershipLevel('level'),
		pointsBalance: integer('points_balance').notNull().default(0),
		guardianName: text('guardian_name'),
		guardianPhone: text('guardian_phone'),
		guardianEmail: text('guardian_email'),
		termsAcceptedAt: timestamp('terms_accepted_at', { withTimezone: true }),
		deletedAt: timestamp('deleted_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date())
	},
	(t) => [
		index('users_role_idx').on(t.role),
		index('users_level_idx').on(t.level),
		index('users_status_idx').on(t.status),
		index('users_name_idx').on(t.lastName, t.firstName),
		check('users_email_lowercase', sql`${t.email} = lower(${t.email})`),
		check('users_locale_valid', sql`${t.locale} in ('en', 'hy', 'ru')`),
		check('users_points_balance_non_negative', sql`${t.pointsBalance} >= 0`)
	]
);
