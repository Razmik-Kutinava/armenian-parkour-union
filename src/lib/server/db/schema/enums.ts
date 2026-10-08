import { pgEnum } from 'drizzle-orm/pg-core';

export const userRole = pgEnum('user_role', ['member', 'editor', 'moderator', 'admin']);
export const userStatus = pgEnum('user_status', ['active', 'blocked']);
export const membershipLevel = pgEnum('membership_level', ['novice', 'advanced', 'pro']);
export const contentStatus = pgEnum('content_status', ['draft', 'published', 'archived']);
