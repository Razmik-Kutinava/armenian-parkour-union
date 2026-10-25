import { pgEnum } from 'drizzle-orm/pg-core';

export const userRole = pgEnum('user_role', ['member', 'editor', 'moderator', 'admin']);
export const userStatus = pgEnum('user_status', ['active', 'blocked']);
export const membershipLevel = pgEnum('membership_level', ['novice', 'advanced', 'pro']);
export const contentStatus = pgEnum('content_status', ['draft', 'published', 'archived']);
export const eventStatus = pgEnum('event_status', [
	'draft',
	'published',
	'finished',
	'cancelled',
	'archived'
]);
export const discipline = pgEnum('discipline', ['speed', 'style', 'tricking', 'freerun', 'other']);
export const heroType = pgEnum('hero_type', ['event', 'presentation', 'video', 'person', 'custom']);
export const membershipStatus = pgEnum('membership_status', [
	'pending',
	'active',
	'expired',
	'cancelled'
]);
export const paymentKind = pgEnum('payment_kind', ['membership', 'donation', 'event_fee']);
export const paymentStatus = pgEnum('payment_status', [
	'pending',
	'paid',
	'failed',
	'cancelled',
	'refunded'
]);
export const pointsReason = pgEnum('points_reason', [
	'certificate',
	'event_registration',
	'event_participation',
	'event_place',
	'video',
	'manual',
	'shop_order',
	'shop_refund',
	'reversal'
]);
export const registrationStatus = pgEnum('registration_status', [
	'registered',
	'pending_payment',
	'waitlist',
	'cancelled',
	'attended',
	'no_show'
]);
export const staffKind = pgEnum('staff_kind', ['trainer', 'judge']);
export const certificateKind = pgEnum('certificate_kind', ['level', 'trainer', 'judge']);
export const certificateStatus = pgEnum('certificate_status', ['active', 'expired', 'revoked']);
export const examKind = pgEnum('exam_kind', ['level_advanced', 'level_pro', 'trainer', 'judge']);
export const examResult = pgEnum('exam_result', ['scheduled', 'passed', 'failed', 'cancelled']);
export const videoStatus = pgEnum('video_status', ['pending', 'approved', 'rejected']);
export const orderStatus = pgEnum('order_status', [
	'new',
	'confirmed',
	'shipped',
	'delivered',
	'cancelled'
]);
export const consentKind = pgEnum('consent_kind', ['parental', 'medical', 'privacy']);
export const consentStatus = pgEnum('consent_status', [
	'pending',
	'approved',
	'rejected',
	'expired'
]);
