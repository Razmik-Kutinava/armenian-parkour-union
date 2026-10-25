import { PUBLIC_SITE_URL } from '$app/env/private';
import type { LimitDb } from '../../auth/rate-limit';
import { sendMail } from '../../mail';
import type { Actor } from '../users/target';
import { moderateVideos, type ModerationInput } from './review';

/* The moderation wired to the real mail. */
export const moderateVideosNow = (
	db: LimitDb,
	actor: Actor,
	ids: string[],
	input: ModerationInput,
	ip: string | null
) => moderateVideos(db, actor, ids, input, { send: sendMail, siteUrl: PUBLIC_SITE_URL, ip });
