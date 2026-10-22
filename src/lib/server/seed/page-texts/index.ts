import { about } from './about';
import { contacts } from './contacts';
import { join } from './join';
import { offer } from './offer';
import { privacy } from './privacy';
import { refundPolicy } from './refund-policy';
import { rules } from './rules';
import type { PageTexts } from './types';

/*
 * First texts of the system pages, written by the owner (2026-10-22). Loaded once by
 * scripts/fill-system-pages.ts; after that the admin panel is the only place to edit them.
 */
export const PAGE_TEXTS: Record<string, PageTexts> = {
	about,
	rules,
	contacts,
	privacy,
	offer,
	'refund-policy': refundPolicy,
	join
};
