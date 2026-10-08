import { t } from '#lib/i18n/index.svelte.ts';

/** "Age 12–14", "Age 8+", "Age up to 10" or nothing. */
export function ageLabel({ ageMin, ageMax }: { ageMin: number | null; ageMax: number | null }) {
	if (ageMin !== null && ageMax !== null) return t('events.ages', { from: ageMin, to: ageMax });
	if (ageMin !== null) return t('events.agesFrom', { from: ageMin });
	if (ageMax !== null) return t('events.agesTo', { to: ageMax });
	return '';
}
