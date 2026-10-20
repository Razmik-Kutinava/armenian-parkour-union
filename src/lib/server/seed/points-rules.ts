import type { LocalizedText } from '#lib/i18n/localized.ts';
import type { LimitDb } from '../auth/rate-limit';
import { pointsRules } from '../db/schema/points';

type SeedRule = { points: number; title: Required<LocalizedText> };

/* docs/03 section 6.1: starting values approved by the owner 2026-10-06, then edited in the admin panel. */
export const SEED_POINTS_RULES: Record<string, SeedRule> = {
	certificate_level_advanced: {
		points: 100,
		title: {
			en: 'Certificate: advanced level',
			hy: 'Հավաստագիր՝ առաջադեմ մակարդակ',
			ru: 'Сертификат уровня «Продвинутый»'
		}
	},
	certificate_level_pro: {
		points: 200,
		title: {
			en: 'Certificate: pro level',
			hy: 'Հավաստագիր՝ պրոֆեսիոնալ մակարդակ',
			ru: 'Сертификат уровня «Профи»'
		}
	},
	certificate_trainer: {
		points: 150,
		title: { en: 'Coach certificate', hy: 'Մարզչի հավաստագիր', ru: 'Сертификат тренера' }
	},
	certificate_judge: {
		points: 150,
		title: { en: 'Judge certificate', hy: 'Մրցավարի հավաստագիր', ru: 'Сертификат судьи' }
	},
	event_registration: {
		points: 5,
		title: {
			en: 'Event registration on the site',
			hy: 'Գրանցում միջոցառմանը կայքում',
			ru: 'Регистрация на событие через сайт'
		}
	},
	event_participation: {
		points: 20,
		title: {
			en: 'Attended an event',
			hy: 'Մասնակցություն միջոցառմանը',
			ru: 'Участие в событии'
		}
	},
	event_place_1: {
		points: 50,
		title: { en: '1st place at an event', hy: '1-ին տեղ միջոցառմանը', ru: '1 место на событии' }
	},
	event_place_2: {
		points: 30,
		title: { en: '2nd place at an event', hy: '2-րդ տեղ միջոցառմանը', ru: '2 место на событии' }
	},
	event_place_3: {
		points: 20,
		title: { en: '3rd place at an event', hy: '3-րդ տեղ միջոցառմանը', ru: '3 место на событии' }
	},
	video_approved: {
		points: 10,
		title: {
			en: 'Video approved by a moderator',
			hy: 'Տեսանյութը հաստատվել է մոդերատորի կողմից',
			ru: 'Видео одобрено модератором'
		}
	}
};

/** Adds missing rules only: points, titles and on/off set in the admin panel are never overwritten. */
export async function seedPointsRules(db: LimitDb): Promise<string[]> {
	const rows = await db
		.insert(pointsRules)
		.values(Object.entries(SEED_POINTS_RULES).map(([code, rule]) => ({ code, ...rule })))
		.onConflictDoNothing({ target: pointsRules.code })
		.returning({ code: pointsRules.code });
	return rows.map((r) => r.code);
}
