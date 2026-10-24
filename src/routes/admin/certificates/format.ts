import { currentLocale, t } from '#lib/i18n/index.svelte.ts';

/* docs/05 section 8: dates as a day in Yerevan; "level or category" in one column. */

export const certificateDay = (date: Date | null) =>
	date
		? date.toLocaleDateString(currentLocale(), { dateStyle: 'medium', timeZone: 'Asia/Yerevan' })
		: '—';

export const levelOrCategory = (c: {
	level: 'advanced' | 'pro' | null;
	category: string | null;
}) => (c.level ? t(`level.${c.level}`) : (c.category ?? '—'));
